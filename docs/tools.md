# Tool reference

Every tool returns JSON as text. Failures come back as a tool error: one sentence with the cause,
and one with the next step.

## Read tools

These exist in every access mode, and they never change a message.

### `list_folders`

No input. Returns up to 200 folders with `path`, `role` (`inbox`, `sent`, `drafts`, `trash`, `junk`,
`archive`, or null), `unread`, and `messages`.

### `search_messages`

| Input | Type | Default | Meaning |
| --- | --- | --- | --- |
| `folder` | string | `INBOX` | folder path |
| `from`, `to`, `subject`, `text` | string | none | text to find in that field, or anywhere for `text` |
| `since`, `before` | `YYYY-MM-DD` | none | date the server received the message |
| `unread`, `flagged` | boolean | none | filter by state |
| `limit` | 1 to 50 | 20 | results to return |
| `offset` | number | 0 | results to skip |

Returns `total`, then the newest messages first, with `uid`, `date`, `from`, `to`, `subject`,
`unread`, `flagged`, `has_attachments`, `size`, and a `snippet` of 200 characters at most.

### `get_message`

| Input | Type | Default | Meaning |
| --- | --- | --- | --- |
| `folder` | string | `INBOX` | folder path |
| `uid` | number | required | from `search_messages` |
| `max_chars` | 100 to 100,000 | 20,000 | body length to return |

Returns the headers, `is_mailing_list`, `body`, `body_truncated`, `body_chars`, and `attachments`
with `index`, `filename`, `content_type`, and `size`. Inline images aren't listed. Messages over
40 MiB are refused.

### `get_attachment`

| Input | Type | Default | Meaning |
| --- | --- | --- | --- |
| `folder` | string | `INBOX` | folder path |
| `uid` | number | required | from `search_messages` |
| `index` | number | required | from `get_message` |
| `max_chars` | 100 to 100,000 | 20,000 | text length to return |

Reads PDF, DOCX, HTML, and plain text formats, up to 25 MiB. Other formats return an error. A
scanned PDF returns a note, because it has no text. Nothing is written to disk.

## Organizing tools

These exist unless you choose `--read-only`.

### `create_draft`

| Input | Type | Meaning |
| --- | --- | --- |
| `to`, `cc`, `bcc` | list of addresses | 20 in total at most |
| `subject` | string | one line |
| `body` | string | required, plain text |
| `reply_to` | object | `folder`, `uid`, `reply_all`, `quote`: makes this a threaded reply |

Saves to the Drafts folder. If the mailbox has none, it creates one. Sends nothing.

### `mark_read` and `flag`

| Input | Type | Default | Meaning |
| --- | --- | --- | --- |
| `folder` | string | `INBOX` | folder path |
| `uids` | list of numbers | required | 50 at most |
| `read` or `flagged` | boolean | `true` | `false` undoes it |

### `move_message`

| Input | Type | Default | Meaning |
| --- | --- | --- | --- |
| `folder` | string | `INBOX` | folder path |
| `uids` | list of numbers | required | 50 at most |
| `destination` | string | required | a folder path, or `trash`, `junk`, or `archive` |

Deleting means moving to `trash`. There is no permanent delete.

## Sending tools

These exist only with `--allow-send`. Sending can't be undone.

### `send_message`

Takes `to`, `cc`, `bcc`, `subject`, and `body`, as `create_draft` does. Sends plain text with no
attachments, then saves a copy to Sent. If the copy fails, the result says so and warns against
sending again.

### `reply`

| Input | Type | Default | Meaning |
| --- | --- | --- | --- |
| `folder` | string | `INBOX` | folder path |
| `uid` | number | required | the message to reply to |
| `body` | string | required | plain text |
| `reply_all` | boolean | `false` | also include the other recipients |
| `quote` | boolean | `true` | quote the original below the reply |

`reply_all` refuses mailing-list mail, so a reply can't reach a whole course by accident.

## Sending limits

DSI blocks an account from sending for 24 hours at 500 emails per day, with lower limits at 200 in 5
minutes and 450 per hour. Each recipient counts as one email. Mass mailings need prior approval.
So this server stops well below that:

| Limit | Value |
| --- | --- |
| Recipients per message | 20 |
| Recipients per hour, per running server | 60 |
| Recipients per day, per running server | 200 |

The counts live in memory, so restarting the server resets them. DSI's own limits still apply.
