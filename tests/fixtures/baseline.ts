import type { Baseline } from '../../src/contracts/baseline.js';

export function createBaseline(): Baseline {
  return {
    width: 1280,
    height: 160.5,
    parentTag: 'body',
    previousSiblingTag: 'main',
    nextSiblingTag: null,
    computedStyles: {
      color: 'rgb(255, 255, 255)',
      'background-color': 'rgb(0, 0, 0)',
      'border-top-color': 'rgb(255, 255, 255)',
      'border-right-color': 'rgb(255, 255, 255)',
      'border-bottom-color': 'rgb(255, 255, 255)',
      'border-left-color': 'rgb(255, 255, 255)',
      'font-family': 'Arial, sans-serif',
      'font-size': '16px',
      'font-weight': '400',
      'line-height': '24px',
      'padding-top': '8px',
      'padding-right': '12px',
      'padding-bottom': '16px',
      'padding-left': '20px',
      'margin-top': '0px',
      'margin-right': '0px',
      'margin-bottom': '0px',
      'margin-left': '0px',
      'border-top-width': '1px',
      'border-right-width': '2px',
      'border-bottom-width': '3px',
      'border-left-width': '4px',
      'border-top-left-radius': '4px',
      'border-top-right-radius': '8px',
      'border-bottom-right-radius': '12px',
      'border-bottom-left-radius': '16px',
    },
  };
}
