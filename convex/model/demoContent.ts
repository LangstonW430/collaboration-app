// The sample content used by convex/seed.ts.
//
// Kept apart from the mutation so it can be checked in a DOM environment: the
// editor sanitizes HTML on every save, and anything the sanitizer strips would
// disappear the first time a visitor typed in a seeded document.

export interface DemoComment {
  /** Matches a data-comment-id in the document's HTML. */
  markId: string;
  text: string;
  quotedText: string;
}

export interface DemoDocument {
  title: string;
  content: string;
  comments?: DemoComment[];
  /** Minutes before now, so the dashboard shows a believable spread. */
  editedMinutesAgo: number;
}

export const DEMO_DOCUMENTS: DemoDocument[] = [
  {
    title: "Welcome to CollabDocs",
    editedMinutesAgo: 4,
    content: [
      "<h1>Welcome to CollabDocs</h1>",
      "<p>This is a real-time collaborative editor. Open this document in two ",
      "browser windows and type — edits appear in both without a reload.</p>",
      "<h2>Try these</h2>",
      '<ul data-type="taskList">',
      '<li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked><span></span></label><div><p>Edit this text — it autosaves about a second after you stop typing</p></div></li>',
      '<li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>Select a phrase and press the comment button to start a thread</p></div></li>',
      '<li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>Use <strong>Share</strong> to invite someone as an editor or a viewer</p></div></li>',
      "</ul>",
      "<p>Formatting works as you would expect: <strong>bold</strong>, <em>italic</em>, ",
      '<u>underline</u>, <code>inline code</code>, and <mark data-color="#fef9c3" ',
      'style="background-color: #fef9c3; color: inherit;">highlighting</mark>.</p>',
      "<blockquote><p>Documents are owned by whoever created them. Collaborators ",
      "get editor or viewer access, and viewers can comment without being able to ",
      "change the text.</p></blockquote>",
    ].join(""),
  },
  {
    title: "Q3 Roadmap Review",
    editedMinutesAgo: 47,
    content: [
      "<h1>Q3 Roadmap Review</h1>",
      "<p>Headline numbers for the quarter, with the detail underneath.</p>",
      '<div data-chart-type="bar" data-chart-title="Weekly active users (thousands)" ',
      'data-chart-labels="Jul, Aug, Sep, Oct" data-chart-values="18, 24, 31, 44" ',
      'data-chart-colors="#3b82f6, #10b981, #f59e0b, #8b5cf6"></div>',
      "<h2>Workstreams</h2>",
      '<table style="min-width: 75px;"><colgroup><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"></colgroup><tbody>',
      '<tr><th colspan="1" rowspan="1"><p>Workstream</p></th><th colspan="1" rowspan="1"><p>Owner</p></th><th colspan="1" rowspan="1"><p>Status</p></th></tr>',
      '<tr><td colspan="1" rowspan="1"><p>Real-time sync</p></td><td colspan="1" rowspan="1"><p>Platform</p></td><td colspan="1" rowspan="1"><p>Shipped</p></td></tr>',
      '<tr><td colspan="1" rowspan="1"><p>Commenting</p></td><td colspan="1" rowspan="1"><p>Editor</p></td><td colspan="1" rowspan="1"><p>In review</p></td></tr>',
      '<tr><td colspan="1" rowspan="1"><p>Offline drafts</p></td><td colspan="1" rowspan="1"><p>Editor</p></td><td colspan="1" rowspan="1"><p>Not started</p></td></tr>',
      "</tbody></table>",
      "<p>Charts are editable — click one to change its type, labels, or values.</p>",
    ].join(""),
  },
  {
    title: "Design notes — editor toolbar",
    editedMinutesAgo: 180,
    content: [
      "<h1>Design notes — editor toolbar</h1>",
      "<p>The toolbar collapses to a single row under 900px. Everything past the ",
      'first six controls moves into an overflow menu.</p>',
      '<p>The <mark data-comment-id="demo-comment-1" class="comment-mark">insert menu ',
      "should stay reachable by keyboard</mark>, since it is the only route to tables ",
      "and charts.</p>",
      "<h2>Open questions</h2>",
      '<p><mark data-comment-id="demo-comment-2" class="comment-mark">Do we need a ',
      "separate mobile layout</mark>, or is the collapsed toolbar enough on a phone?</p>",
      "<pre><code>// Toolbar breakpoint\n@media (max-width: 900px) { .toolbar { flex-wrap: nowrap; } }</code></pre>",
    ].join(""),
    comments: [
      {
        markId: "demo-comment-1",
        text: "Agreed — tab order should reach it before the formatting controls.",
        quotedText: "insert menu should stay reachable by keyboard",
      },
      {
        markId: "demo-comment-2",
        text: "Let's see how the collapsed version tests first.",
        quotedText: "Do we need a separate mobile layout",
      },
    ],
  },
];

