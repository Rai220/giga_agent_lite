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

export const WEB_SEARCH_DEF: GigaChatFunction = {
  name: 'web_search',
  description:
    'Search the internet using DuckDuckGo. ' +
    'Use this when the user asks about current events, needs to look something up online, ' +
    'or needs information you don\'t have. Returns a list of search results with titles, URLs, and snippets.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query to look up on DuckDuckGo.',
      },
    },
    required: ['query'],
  },
};

export const READ_FILE_DEF: GigaChatFunction = {
  name: 'read_uploaded_file',
  description:
    'Read the content of a file that the user has uploaded/attached to the conversation. ' +
    'Use list_uploaded_files first to see available files.',
  parameters: {
    type: 'object',
    properties: {
      filename: {
        type: 'string',
        description: 'The name of the uploaded file to read.',
      },
    },
    required: ['filename'],
  },
};

export const LIST_FILES_DEF: GigaChatFunction = {
  name: 'list_uploaded_files',
  description:
    'List all files that the user has uploaded/attached to the conversation. ' +
    'Returns file names, sizes, and types.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const DATETIME_DEF: GigaChatFunction = {
  name: 'current_datetime',
  description:
    'Get the current date and time. Use when the user asks about the current date, time, or day of the week.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const GENERATE_IMAGE_DEF: GigaChatFunction = {
  name: 'generate_image',
  description:
    'Generate an image from a text description using Nano Banana Pro (Google). ' +
    'Use this when the user asks to create, draw, generate, or visualize an image. ' +
    'Provide a detailed prompt in English for best results.',
  parameters: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description:
          'Detailed text description of the image to generate. English prompts work best.',
      },
    },
    required: ['prompt'],
  },
};

export const ALL_FUNCTIONS: GigaChatFunction[] = [
  EXECUTE_JS_DEF,
  WEB_SEARCH_DEF,
  READ_FILE_DEF,
  LIST_FILES_DEF,
  DATETIME_DEF,
  GENERATE_IMAGE_DEF,
];
