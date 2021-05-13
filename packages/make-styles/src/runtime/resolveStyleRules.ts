import hashString from '@emotion/hash';
import { convert, convertProperty } from 'rtl-css-js/core';

import { HASH_PREFIX } from '../constants';
import { MakeStyles, ResolvedClassesForSlot, ResolvedCSSRules, StyleBucketName } from '../types';
import { compileCSS, CompileCSSOptions } from './compileCSS';
import { compileKeyframeRule, compileKeyframesCSS } from './compileKeyframeCSS';
import { expandShorthand } from './expandShorthand';
import { generateCombinedQuery } from './utils/generateCombinedMediaQuery';
import { isMediaQuerySelector } from './utils/isMediaQuerySelector';
import { isNestedSelector } from './utils/isNestedSelector';
import { isSupportQuerySelector } from './utils/isSupportQuerySelector';
import { normalizeNestedProperty } from './utils/normalizeNestedProperty';
import { isObject } from './utils/isObject';
import { getStyleBucketName } from './getStyleBucketName';
import { hashClassName } from './utils/hashClassName';
import { resolveProxyValues } from './createCSSVariablesProxy';
import { hashPropertyKey } from './utils/hashPropertyKey';

function pushResolvedClasses(
  resolvedClasses: ResolvedClassesForSlot,
  propertyKey: string,
  ltrClassname: string,
  rtlClassname: string | undefined,
) {
  resolvedClasses[propertyKey] = rtlClassname ? [ltrClassname!, rtlClassname] : ltrClassname;
}

function pushResolvedCSSRules(
  resolvedCSSRules: ResolvedCSSRules,
  styleBucketName: StyleBucketName,
  ltrCSS: string,
  rtlCSS: string | undefined,
) {
  resolvedCSSRules[styleBucketName] = resolvedCSSRules[styleBucketName] || [];
  resolvedCSSRules[styleBucketName]!.push(ltrCSS);

  if (rtlCSS) {
    resolvedCSSRules[styleBucketName]!.push(rtlCSS);
  }
}

/**
 * Transforms input styles to resolved rules: generates classnames and CSS.
 *
 * @internal
 */
export function resolveStyleRules(
  styles: MakeStyles,
  unstable_cssPriority: number = 0,
  pseudo = '',
  media = '',
  support = '',
  resolvedClasses: ResolvedClassesForSlot = {},
  resolvedCSSRules: ResolvedCSSRules = {},
  rtlValue?: string,
): [ResolvedClassesForSlot, ResolvedCSSRules] {
  const expandedStyles: MakeStyles = expandShorthand(resolveProxyValues(styles));

  // eslint-disable-next-line guard-for-in
  for (const property in expandedStyles) {
    const value = expandedStyles[property];

    // eslint-disable-next-line eqeqeq
    if (value == null) {
      continue;
    }

    if (typeof value === 'string' || typeof value === 'number') {
      // uniq key based on a hash of property & selector, used for merging later
      const key = hashPropertyKey(pseudo, media, support, property);
      const className = hashClassName({
        media,
        value: value.toString(),
        support,
        pseudo,
        property,
        unstable_cssPriority,
      });

      const rtlDefinition = (rtlValue && { key: property, value: rtlValue }) || convertProperty(property, value);
      const flippedInRtl = rtlDefinition.key !== property || rtlDefinition.value !== value;

      const rtlClassName = hashClassName({
        value: rtlDefinition.value.toString(),
        property: rtlDefinition.key,
        pseudo,
        media,
        support,
        unstable_cssPriority,
      });

      const rtlCompileOptions: Partial<CompileCSSOptions> | undefined = flippedInRtl
        ? {
            rtlClassName,
            rtlProperty: rtlDefinition.key,
            rtlValue: rtlDefinition.value,
          }
        : undefined;

      const styleBucketName = getStyleBucketName(pseudo, media, support);
      const [ltrCSS, rtlCSS] = compileCSS({
        className,
        media,
        pseudo,
        property,
        support,
        value,
        unstable_cssPriority,
        ...rtlCompileOptions,
      });

      pushResolvedClasses(resolvedClasses, key, className, flippedInRtl ? rtlClassName : undefined);
      pushResolvedCSSRules(resolvedCSSRules, styleBucketName, ltrCSS, rtlCSS);
    } else if (property === 'animationName') {
      const animationNames = Array.isArray(value) ? value : [value];
      let keyframeCSS = '';
      let keyframeRtlCSS = '';

      const names = [];
      const namesRtl = [];

      for (const val of animationNames) {
        const keyframe = compileKeyframeRule(val);
        const name = HASH_PREFIX + hashString(keyframe);

        keyframeCSS += compileKeyframesCSS(name, keyframe);
        names.push(name);

        const rtlKeyframe = compileKeyframeRule(convert(val));

        if (keyframe !== rtlKeyframe) {
          const nameRtl = HASH_PREFIX + hashString(rtlKeyframe);
          keyframeRtlCSS += compileKeyframesCSS(nameRtl, rtlKeyframe);
          namesRtl.push(nameRtl);
        } else {
          namesRtl.push(name);
        }
      }

      const animationName = names.join(' ');
      const animationNameRtl = namesRtl.join(' ');

      pushResolvedCSSRules(
        resolvedCSSRules,
        'k', // keyframes styles should be inserted into own bucket
        keyframeCSS,
        keyframeRtlCSS || undefined,
      );
      resolveStyleRules(
        { animationName },
        unstable_cssPriority,
        pseudo,
        media,
        support,
        resolvedClasses,
        resolvedCSSRules,
        animationNameRtl,
      );
    } else if (isObject(value)) {
      if (isNestedSelector(property)) {
        resolveStyleRules(
          value,
          unstable_cssPriority,
          pseudo + normalizeNestedProperty(property),
          media,
          support,
          resolvedClasses,
          resolvedCSSRules,
        );
      } else if (isMediaQuerySelector(property)) {
        const combinedMediaQuery = generateCombinedQuery(media, property.slice(6).trim());

        resolveStyleRules(
          value,
          unstable_cssPriority,
          pseudo,
          combinedMediaQuery,
          support,
          resolvedClasses,
          resolvedCSSRules,
        );
      } else if (isSupportQuerySelector(property)) {
        const combinedSupportQuery = generateCombinedQuery(support, property.slice(9).trim());

        resolveStyleRules(
          value,
          unstable_cssPriority,
          pseudo,
          media,
          combinedSupportQuery,
          resolvedClasses,
          resolvedCSSRules,
        );
      }
    }
  }

  return [resolvedClasses, resolvedCSSRules];
}
