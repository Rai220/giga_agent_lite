# GigaAgent Lite — UI Test Cases

## TC-001: Provider switching
1. Open the app
2. Select different providers from the dropdown (GigaChat, OpenAI, Anthropic, Gemini)
3. **Expected:** Provider changes, settings gear opens correct form for each

## TC-002: Settings modal
1. Click ⚙ settings
2. Verify form fields match the current provider
3. Enter/modify values and click Save
4. Re-open settings
5. **Expected:** Values persist after save

## TC-003: Send message
1. Type a message and press Enter or click Send
2. **Expected:** Message appears in chat, agent responds

## TC-004: Conversation history
1. Send a message to create a conversation
2. Click "+ New" to start a new conversation
3. Click the previous conversation in the sidebar
4. **Expected:** Previous conversation messages are restored

## TC-005: Tool call — execute_js
1. Ask: "Calculate 2 + 2"
2. **Expected:** Agent calls execute_js, code block shown, result "4" displayed

## TC-006: Tool call — web_search
1. Ask: "Search for Vite.js"
2. **Expected:** Agent calls web_search, results displayed

## TC-007: File upload and read
1. Click the paperclip icon, upload a text file
2. Ask: "Read the uploaded file"
3. **Expected:** File chip appears, agent reads file content

## TC-008: CSV file reading
1. Upload a .csv file
2. Ask: "Read the CSV file and show the columns"
3. **Expected:** Agent calls read_csv, returns structured JSON with columns and data

## TC-009: Excel file reading
1. Upload a .xlsx file
2. Ask: "Read the Excel file"
3. **Expected:** Agent calls read_excel, returns sheet data as JSON

## TC-010: Chart generation
1. Ask: "Create a bar chart with data: Jan=10, Feb=20, Mar=15, Apr=25"
2. **Expected:** Agent uses execute_js with Chart.js, chart image appears in chat

## TC-011: Document creation
1. Ask: "Create a CSV file with columns name, age and 3 sample rows"
2. **Expected:** Agent calls create_document, download card appears with filename and download button

## TC-012: Memory save and recall
1. Say: "Remember that my name is Alice"
2. Start a new conversation
3. Ask: "What is my name?"
4. **Expected:** Agent uses memory_save, then recalls from memory in new conversation

## TC-013: Memory management in settings
1. After saving memory, open ⚙ settings
2. Scroll to Memory section
3. **Expected:** Memory entries visible with delete buttons

## TC-014: Think tool
1. Ask a complex question requiring reasoning
2. **Expected:** Collapsible "Thinking..." block appears, clickable to expand

## TC-015: Critic tool
1. Ask the agent to solve a problem and verify its work
2. **Expected:** Collapsible "Self-critique..." block appears

## TC-016: Large result collapsing
1. Upload a large text file and ask the agent to read it
2. **Expected:** Tool result is collapsed with "Show full result" button

## TC-017: Directory picker
1. Click the folder icon in the input area
2. Select a directory
3. **Expected:** Directory name shown next to the icon

## TC-018: File system — read/write/grep
1. Select a working directory
2. Ask: "List files in the directory" or "Read file X"
3. **Expected:** Agent uses file_read/file_grep tools on the selected directory

## TC-019: Markdown rendering
1. Ask a question that produces markdown (headers, lists, code blocks, tables)
2. **Expected:** Rendered with proper formatting and syntax highlighting

## TC-020: Error handling
1. Try to send a message without configuring API keys
2. **Expected:** Error message displayed in chat

## TC-021: Delete conversation
1. Hover over a conversation in the sidebar
2. Click the × delete button
3. **Expected:** Conversation removed from list

## TC-022: Responsive layout
1. Resize the browser to mobile width
2. **Expected:** Sidebar collapses, hamburger menu works
