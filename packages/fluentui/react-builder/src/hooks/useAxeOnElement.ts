import * as React from 'react';
import * as axeCore from 'axe-core';
// import { AccessibilityErrors } from '../components/AbilityAttributesValidator';
// import { xor } from 'lodash';

export function useAxe(): [{}, () => void] {
  // const [axeAllErrors, setAxeAllErrors] = React.useState([]);
  const [axeAllErrors, setAxeAllErrors] = React.useState({});

  const runAxe = React.useCallback(async () => {
    // const iframe = document.getElementsByTagName('iframe')[0];
    await axeCore.run(
      // iframe,
      {
        rules: {
          // excluding rules which are related to the whole page not to components
          'page-has-heading-one': { enabled: false },
          region: { enabled: false },
          'landmark-one-main': { enabled: false },
        },
      } as axeCore.RunOptions,
      (err, result) => {
        if (err) {
          console.error(`Axe failed: ${err.message}`);
        } else {
          const output = {};
          result.violations.forEach(violation => {
            violation.nodes.forEach(node => {
              const match = node.html.match(/data-builder-id=\"(.+?)\"/);
              if (match) {
                const dataBuilderId = match[1];
                output[dataBuilderId] = processNodeErrors(node);
              }
            });
          });
          setAxeAllErrors(output);
        }
      },
    );
  }, []);
  return [axeAllErrors, runAxe];
}

const processNodeErrors = (node: axeCore.NodeResult) => {
  return node.any.concat(node.all, node.none).map(x => x.message);
};

export function useAxeOnElement(): [any[], (selectedElementUuid: any) => void] {
  const [axeErrors, setAxeErrors] = React.useState([]);
  const runAxeOnElement = React.useCallback(selectedElementUuid => {
    const iframe = document.getElementsByTagName('iframe')[0];
    const selectedComponentAxeErrors = [];
    axeCore.run(
      iframe,
      {
        rules: {
          // excluding rules which are related to the whole page not to components
          'page-has-heading-one': { enabled: false },
          region: { enabled: false },
          'landmark-one-main': { enabled: false },
        },
      },
      (err, result) => {
        if (err) {
          console.error('Axe failed', err);
        } else {
          result.violations.forEach(violation => {
            violation.nodes.forEach(node => {
              if (node.html.includes(`data-builder-id="${selectedElementUuid}"`)) {
                selectedComponentAxeErrors.push({
                  failureSummary: scrubFailureSummary(node.failureSummary),
                  dataBuilderId: selectedElementUuid,
                });
              }
            });
          });
        }
        setAxeErrors(selectedComponentAxeErrors);
      },
    );
  }, []);

  return [axeErrors, runAxeOnElement];
}

const scrubFailureSummary = (summary: string): string => {
  return summary.replace('Fix all of the following:', '').replace('Fix any of the following:', '');
};
