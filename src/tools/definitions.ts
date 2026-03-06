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

export const THINK_DEF: GigaChatFunction = {
  name: 'think',
  description:
    'Use this tool to think step-by-step. It does not retrieve new information or change state — ' +
    'it simply logs your thought. Use when you need complex reasoning, to analyze results, ' +
    'verify a plan, or cache intermediate conclusions.',
  parameters: {
    type: 'object',
    properties: {
      thought: {
        type: 'string',
        description: 'Your thought or reasoning to log.',
      },
    },
    required: ['thought'],
  },
};

export const CRITIC_DEF: GigaChatFunction = {
  name: 'critic',
  description:
    'Use this tool to critically evaluate your actions or plan. ' +
    'Record what might go wrong, weak spots, and how to improve your approach.',
  parameters: {
    type: 'object',
    properties: {
      criticism: {
        type: 'string',
        description: 'Critical analysis of the current approach, plan, or result.',
      },
    },
    required: ['criticism'],
  },
};

export const MEMORY_SAVE_DEF: GigaChatFunction = {
  name: 'memory_save',
  description:
    'Save a fact or note to persistent memory. Memory persists across sessions and is automatically included in the system prompt.',
  parameters: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'Topic/key for the memory entry (e.g. "name", "language", "preferences").',
      },
      content: {
        type: 'string',
        description: 'The fact or note to remember.',
      },
    },
    required: ['key', 'content'],
  },
};

export const MEMORY_LIST_DEF: GigaChatFunction = {
  name: 'memory_list',
  description: 'Show all saved memory entries.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const MEMORY_DELETE_DEF: GigaChatFunction = {
  name: 'memory_delete',
  description: 'Delete a memory entry by key.',
  parameters: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'The key of the memory entry to delete.',
      },
    },
    required: ['key'],
  },
};

export const CREATE_DOCUMENT_DEF: GigaChatFunction = {
  name: 'create_document',
  description:
    'Create a downloadable document. Supported formats: csv, xlsx, pdf, md, txt. ' +
    'Returns a download link displayed to the user.',
  parameters: {
    type: 'object',
    properties: {
      filename: {
        type: 'string',
        description: 'File name with extension (e.g. "report.csv", "data.xlsx", "notes.pdf").',
      },
      content: {
        type: 'string',
        description: 'Document content. For CSV: comma-separated rows. For XLSX: JSON array of objects or CSV text. For PDF/MD/TXT: plain text.',
      },
    },
    required: ['filename', 'content'],
  },
};

export const READ_CSV_DEF: GigaChatFunction = {
  name: 'read_csv',
  description:
    'Read a CSV file that the user has uploaded. Returns data as a JSON array of objects.',
  parameters: {
    type: 'object',
    properties: {
      filename: {
        type: 'string',
        description: 'Name of the uploaded CSV file.',
      },
    },
    required: ['filename'],
  },
};

export const READ_EXCEL_DEF: GigaChatFunction = {
  name: 'read_excel',
  description:
    'Read an Excel (.xlsx/.xls) file that the user has uploaded. Returns data as a JSON array of objects.',
  parameters: {
    type: 'object',
    properties: {
      filename: {
        type: 'string',
        description: 'Name of the uploaded Excel file.',
      },
      sheet: {
        type: 'string',
        description: 'Sheet name to read (optional, defaults to first sheet).',
      },
    },
    required: ['filename'],
  },
};

export const READ_PDF_DEF: GigaChatFunction = {
  name: 'read_pdf',
  description:
    'Extract text from a PDF file that the user has uploaded.',
  parameters: {
    type: 'object',
    properties: {
      filename: {
        type: 'string',
        description: 'Name of the uploaded PDF file.',
      },
    },
    required: ['filename'],
  },
};

export const FILE_READ_DEF: GigaChatFunction = {
  name: 'file_read',
  description:
    'Read a file from the user\'s selected directory (File System Access API). ' +
    'Can read full file or a range of lines.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Relative path to the file within the selected directory.',
      },
      offset: {
        type: 'number',
        description: 'Start line (1-based, optional).',
      },
      limit: {
        type: 'number',
        description: 'Number of lines to read (optional).',
      },
    },
    required: ['path'],
  },
};

export const FILE_WRITE_DEF: GigaChatFunction = {
  name: 'file_write',
  description:
    'Write content to a file in the user\'s selected directory (File System Access API). ' +
    'Creates the file if it doesn\'t exist, overwrites if it does.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Relative path to the file within the selected directory.',
      },
      content: {
        type: 'string',
        description: 'Content to write to the file.',
      },
    },
    required: ['path', 'content'],
  },
};

export const FILE_GREP_DEF: GigaChatFunction = {
  name: 'file_grep',
  description:
    'Search for a pattern in files within the user\'s selected directory (File System Access API). ' +
    'Supports regex patterns and file glob filtering.',
  parameters: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Search pattern (regex supported).',
      },
      glob: {
        type: 'string',
        description: 'File glob pattern to filter files (e.g. "*.ts", "*.py"). Optional.',
      },
    },
    required: ['pattern'],
  },
};

export const ALL_FUNCTIONS: GigaChatFunction[] = [
  EXECUTE_JS_DEF,
  WEB_SEARCH_DEF,
  READ_FILE_DEF,
  LIST_FILES_DEF,
  DATETIME_DEF,
  THINK_DEF,
  CRITIC_DEF,
  MEMORY_SAVE_DEF,
  MEMORY_LIST_DEF,
  MEMORY_DELETE_DEF,
  CREATE_DOCUMENT_DEF,
  READ_CSV_DEF,
  READ_EXCEL_DEF,
  READ_PDF_DEF,
  FILE_READ_DEF,
  FILE_WRITE_DEF,
  FILE_GREP_DEF,
];
