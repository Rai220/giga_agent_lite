import type { Function as GigaChatFunction } from 'gigachat/interfaces';

export const EXECUTE_JS_DEF: GigaChatFunction = {
  name: 'execute_js',
  description:
    'Execute JavaScript code in an isolated sandbox. ' +
    'Use this for calculations, data processing, string manipulation, generating data, etc. ' +
    'The code runs in a browser iframe with no DOM/network access. ' +
    'Use "return <value>" to return a result. console.log() output is also captured.',
  parameters: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'JavaScript code to execute. Use "return expr" to return a value.',
      },
    },
    required: ['code'],
  },
};

export const ALL_FUNCTIONS: GigaChatFunction[] = [EXECUTE_JS_DEF];
