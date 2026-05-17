# generate-utility-tree.py
# Generates docs/UTILITY-TREE.docx — Utility Tree for NovelHub
# Run: python docs/generate-utility-tree.py

import os
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_ALIGN_VERTICAL, WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import copy

# ── Helpers ────────────────────────────────────────────────────────────────────

def set_cell_bg(cell, hex_color: str):
    """Fill a table cell background with a hex colour (e.g. '4472C4')."""
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), hex_color)
    tcPr.append(shd)


def set_cell_border(cell, **kwargs):
    """Set borders on a cell. kwargs: top, bottom, left, right — each a dict
    with keys 'sz', 'val', 'color'."""
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    tcBorders = OxmlElement('w:tcBorders')
    for side, cfg in kwargs.items():
        el = OxmlElement(f'w:{side}')
        el.set(qn('w:val'),   cfg.get('val',   'single'))
        el.set(qn('w:sz'),    str(cfg.get('sz', 4)))
        el.set(qn('w:space'), '0')
        el.set(qn('w:color'), cfg.get('color', '000000'))
        tcBorders.append(el)
    tcPr.append(tcBorders)


def set_row_height(row, height_cm: float):
    """Set a minimum row height in cm."""
    tr = row._tr
    trPr = tr.get_or_add_trPr()
    trHeight = OxmlElement('w:trHeight')
    # 1 cm = 567 twips
    twips = int(height_cm * 567)
    trHeight.set(qn('w:val'), str(twips))
    trHeight.set(qn('w:hRule'), 'atLeast')
    trPr.append(trHeight)


def add_run(para, text: str, bold=False, italic=False,
            font_size=10, color=None, font_name='Calibri'):
    run = para.add_run(text)
    run.bold   = bold
    run.italic = italic
    run.font.name = font_name
    run.font.size = Pt(font_size)
    if color:
        run.font.color.rgb = RGBColor(*bytes.fromhex(color))
    return run


def cell_para(cell, text: str, bold=False, italic=False, font_size=10,
              color=None, align=WD_ALIGN_PARAGRAPH.LEFT):
    """Clear a cell and add a paragraph with the given text."""
    cell.paragraphs[0].clear()
    para = cell.paragraphs[0]
    para.alignment = align
    cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
    if text:
        add_run(para, text, bold=bold, italic=italic,
                font_size=font_size, color=color)
    return para


def merge_rows(table, col: int, start_row: int, end_row: int):
    """Vertically merge cells in `col` from start_row to end_row (inclusive)."""
    if start_row == end_row:
        return
    a = table.cell(start_row, col)
    b = table.cell(end_row,   col)
    a.merge(b)


# ── Colour palette ─────────────────────────────────────────────────────────────
HDR_BG     = '2E4057'   # dark blue-grey — header row background
HDR_FG     = 'FFFFFF'   # white text for header
L1_BG      = 'D9E1F2'   # light blue — Level-1 cells
L2_BG      = 'EEF2FA'   # very light blue — Level-2 cells
ROW_ALT    = 'F8F9FC'   # alternate row tint
BV_H       = 'C6EFCE'   # green tint — High business value
BV_M       = 'FFEB9C'   # yellow tint — Medium
BV_L       = 'FCE4D6'   # red/orange tint — Low
TR_H       = 'FCE4D6'   # red — High technical risk
TR_M       = 'FFEB9C'   # yellow — Medium
TR_L       = 'C6EFCE'   # green — Low

BV_COLOR = {'H': BV_H, 'M': BV_M, 'L': BV_L}
TR_COLOR = {'H': TR_H, 'M': TR_M, 'L': TR_L}

# ── Utility tree data ──────────────────────────────────────────────────────────
# Each row: (Level1, Level2, Level3 scenario, Business Value, Technical Risk)
# Empty Level1/Level2 = same as previous (will be merged).

ROWS = [
    # ── SECURITY ────────────────────────────────────────────────────────────────
    ("Security",
     "Data\nConfidentiality",
     "User registers an account; password must be hashed with bcrypt "
     "(cost ≥ 12) before storage. Session cookie is HTTP-only, Secure, "
     "and SameSite=Lax — never readable by client-side JavaScript. (UC-01, UC-02)",
     "H", "M"),

    ("", "Authentication",
     "User signs in; system rate-limits to 10 failed attempts per IP per "
     "15 minutes. Lockout prevents brute-force without disclosing which "
     "field was wrong (same error for unknown email and wrong password). (UC-02)",
     "H", "M"),

    ("", "Authorization",
     "Reader directly requests /admin or /curator route; system reads role "
     "from the database session on every request — never from a cookie or "
     "client header — and returns HTTP 403 without revealing page content. "
     "(UC-21, UC-22, UC-23)",
     "H", "M"),

    ("", "VIP Content\nProtection",
     "Reader crafts a direct URL to a VIP chapter without paying; server "
     "strips content before responding — content is never hidden via CSS. "
     "The response payload contains an empty string, not the chapter body. "
     "(UC-10, UC-18)",
     "H", "H"),

    ("", "Payment\nWebhook Integrity",
     "MoMo sends a callback to /api/payments/momo/webhook; system verifies "
     "HMAC-SHA256 signature with the MoMo secret key before any DB write. "
     "Invalid signatures → HTTP 400 and an audit log entry. (UC-17)",
     "H", "H"),

    # ── RELIABILITY ─────────────────────────────────────────────────────────────
    ("Reliability",
     "Payment\nCorrectness",
     "MoMo retries the same success webhook for orderId X; system detects "
     "the existing COMPLETED payment record and returns HTTP 200 without "
     "re-crediting coins. Idempotency enforced by unique orderId check before "
     "transaction begins. (UC-17)",
     "H", "H"),

    ("", "Coin Ledger\nAtomicity",
     "Reader unlocks a VIP chapter; coin deduction, chapter_unlocks insert, "
     "and coin_transactions entry succeed together or all roll back in a single "
     "DB transaction — no partial coin loss or double unlock. (UC-18)",
     "H", "H"),

    ("", "Search\nFallback",
     "Meilisearch becomes unavailable during peak traffic; system detects "
     "the failure within 200 ms and falls back to PostgreSQL ILIKE search "
     "on the title field — reader sees results, not an error page. (UC-07)",
     "M", "M"),

    ("", "Session\nExpiry Handling",
     "Reader's session expires while browsing; middleware redirects gracefully "
     "to /sign-in?callbackURL=<current page> — no white screen, no data "
     "corruption, and the reader returns to the same page after re-authenticating. "
     "(UC-02, UC-04)",
     "M", "L"),

    # ── PERFORMANCE ─────────────────────────────────────────────────────────────
    ("Performance",
     "Chapter Read\nLatency",
     "Reader opens a published (free or already-unlocked) chapter during "
     "normal traffic; full page content is server-side rendered; P95 server "
     "response time is under 1 second. VIP access check is included in this "
     "budget. (UC-10)",
     "H", "M"),

    ("", "Home Page LCP",
     "First-time visitor loads the home page on a 4G mobile device; Largest "
     "Contentful Paint (LCP) must be under 2.5 seconds. Featured novel covers "
     "are served via Cloudinary CDN with WebP auto-format and priority hints.",
     "H", "M"),

    ("", "Search\nResponse Time",
     "Reader types a search query; Meilisearch returns ranked, typo-tolerant "
     "results for the P95 case in under 200 ms. The 300 ms client-side debounce "
     "ensures requests are not sent on every keystroke. (UC-07)",
     "M", "M"),

    ("", "Asset Delivery",
     "Reader browses the novel list; cover images served by Cloudinary CDN "
     "with WebP auto-format and responsive sizes load in under 1 second on a "
     "4G connection. Cloudflare edge caches static assets globally.",
     "M", "L"),

    # ── USABILITY ───────────────────────────────────────────────────────────────
    ("Usability",
     "Search Typo\nTolerance",
     "Reader searches for a novel title with a 1–2 character typo; Meilisearch "
     "returns the correct novel without requiring an exact match. Default typo "
     "tolerance is enabled for all titles longer than 8 characters. (UC-07)",
     "M", "M"),

    ("", "Reader\nCustomization",
     "Reader adjusts font family (Serif/Sans), font size (14–26 px), line height "
     "(1.4–2.2×), content width (480–900 px), and theme (Sáng/Tối/Đêm) in the "
     "settings sheet; changes apply in real-time with no page reload and persist "
     "in localStorage on the next visit. (UC-11)",
     "H", "L"),

    ("", "Mobile Reading\nExperience",
     "Reader opens the chapter reader on a 375 px wide mobile device; content "
     "is readable without horizontal scrolling; fixed top and bottom bars do not "
     "permanently obscure text; touch swipe between chapters is intuitive.",
     "H", "M"),

    ("", "URL-Driven\nFilters",
     "Reader applies a genre filter and status filter on /novels; the resulting "
     "URL encodes the active filter state so the filtered view can be bookmarked, "
     "shared, and restored on reload without any additional interaction. "
     "(UC-06, UC-08)",
     "M", "L"),

    # ── MAINTAINABILITY ─────────────────────────────────────────────────────────
    ("Maintainability",
     "Solo\nDeployability",
     "A single developer merges a feature branch to main; Vercel detects the "
     "push and auto-deploys the Next.js build with zero manual server steps and "
     "no self-hosted infrastructure to manage. PR preview deployments are "
     "created automatically.",
     "H", "L"),

    ("", "Module\nIsolation",
     "Developer adds the community module (comments, reviews); it calls only "
     "exported service functions from content and auth modules — no direct "
     "cross-module DB queries. Violations are caught by import-path linting rules.",
     "M", "M"),

    ("", "Non-Destructive\nMigrations",
     "Developer adds a nullable column to novels via pnpm db:push; migration "
     "runs on Neon serverless without table locking or reader-visible downtime. "
     "Rollback is possible by reverting the schema and re-pushing.",
     "M", "M"),

    # ── SEO ─────────────────────────────────────────────────────────────────────
    ("SEO",
     "SSR\nIndexability",
     "Search engine crawler visits /novels/[slug]; the full page HTML — including "
     "novel title, synopsis, structured data (JSON-LD Book schema), Open Graph "
     "tags, and canonical URL — is present in the initial response without "
     "executing JavaScript. (UC-09)",
     "H", "M"),

    ("", "Canonical URL\nEnforcement",
     "Reader applies multiple filter combinations to /novels (genre + status + "
     "sort); each unique result set has exactly one canonical URL; alternate "
     "permutations include rel=canonical pointing to the primary URL to prevent "
     "duplicate content indexing. (UC-06)",
     "M", "L"),

    # ── AUDITABILITY ────────────────────────────────────────────────────────────
    ("Auditability",
     "Admin Action\nLogging",
     "Admin promotes a reader to curator or bans a user account; an audit_logs "
     "record is written atomically with the role change — fields: adminId, action, "
     "targetType, targetId, metadata (JSON), createdAt. Audit rows are insert-only "
     "and cannot be deleted. (UC-23)",
     "H", "L"),

    ("", "Moderation\nTraceability",
     "Admin deletes a reported comment or review; the audit log entry records "
     "which admin, which content object, and the exact timestamp — enabling review "
     "of every moderation decision after the fact. (UC-16, UC-23)",
     "M", "L"),

    ("", "Coin Transaction\nLedger",
     "Reader purchases a coin package or unlocks a VIP chapter; a coin_transactions "
     "row (type = CREDIT or DEBIT, amount, description, createdAt) is written in "
     "the same DB transaction as the balance change — every balance mutation has a "
     "corresponding ledger entry for financial reconciliation. (UC-17, UC-18)",
     "H", "M"),

    # ── SCALABILITY ─────────────────────────────────────────────────────────────
    ("Scalability",
     "Concurrent\nReader Capacity",
     "500 authenticated readers open chapter pages simultaneously during a popular "
     "novel update; Neon serverless connection pool handles the load without query "
     "timeouts or HTTP 500 errors. This is the Phase 2 target; Phase 3 targets "
     "10 000 concurrent sessions.",
     "M", "M"),

    ("", "Follower\nNotifications",
     "Curator publishes a new chapter for a novel with 2 000+ followers; Phase 2 "
     "sends notifications synchronously (acceptable for early traffic). Phase 3 "
     "extracts delivery to a background queue (Upstash QStash or BullMQ) when "
     "synchronous processing exceeds 3 seconds. (UC-12, UC-22)",
     "M", "H"),

    ("", "Content Index\nGrowth",
     "Novel catalogue grows beyond the Meilisearch free-tier limit (100 000 "
     "documents); platform upgrades to a paid Meilisearch Cloud plan without "
     "code changes or re-indexing effort — only the API key and index URL change "
     "in environment variables.",
     "L", "M"),
]

# ── Column widths (cm) ─────────────────────────────────────────────────────────
COL_WIDTHS = [3.2, 3.2, 9.2, 2.2, 2.2]   # L1, L2, L3 (scenario), BV, TR


def build_document(output_path: str):
    doc = Document()

    # ── Page margins ──────────────────────────────────────────────────────────
    for section in doc.sections:
        section.top_margin    = Cm(1.8)
        section.bottom_margin = Cm(1.8)
        section.left_margin   = Cm(2.0)
        section.right_margin  = Cm(2.0)

    # ── Title ─────────────────────────────────────────────────────────────────
    title_para = doc.add_paragraph()
    title_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_run(title_para, 'Utility Tree: NovelHub', bold=True,
            font_size=18, color='2E4057')
    doc.add_paragraph()  # spacer

    sub_para = doc.add_paragraph()
    sub_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_run(sub_para, 'Vietnamese Novel Reading Platform  ·  v1.0  ·  17 May 2026',
            font_size=11, color='555555')
    doc.add_paragraph()

    # ── Legend ────────────────────────────────────────────────────────────────
    leg = doc.add_paragraph()
    add_run(leg, 'Business Value / Technical Risk:  ', bold=True, font_size=10)
    add_run(leg, 'H = High   ', font_size=10)
    add_run(leg, 'M = Medium   ', font_size=10)
    add_run(leg, 'L = Low', font_size=10)
    doc.add_paragraph()

    # ── Table ─────────────────────────────────────────────────────────────────
    n_data = len(ROWS)
    table  = doc.add_table(rows=1 + n_data, cols=5)
    table.style = 'Table Grid'
    table.alignment = WD_TABLE_ALIGNMENT.CENTER

    # Set column widths
    for row in table.rows:
        for i, w in enumerate(COL_WIDTHS):
            row.cells[i].width = Cm(w)

    # ── Header row ────────────────────────────────────────────────────────────
    headers = [
        'Level 1:\nQuality\nAttribute',
        'Level 2:\nAttribute\nRefinement',
        'Level 3:\nScenario\n(Derived from Use Cases)',
        'Business\nValue',
        'Technical\nRisk',
    ]
    hdr_row = table.rows[0]
    set_row_height(hdr_row, 1.4)
    for i, h in enumerate(headers):
        c = hdr_row.cells[i]
        set_cell_bg(c, HDR_BG)
        p = cell_para(c, h, bold=True, font_size=10,
                      color=HDR_FG, align=WD_ALIGN_PARAGRAPH.CENTER)

    # ── Data rows ─────────────────────────────────────────────────────────────
    l1_start = 1   # table row index where current L1 block started
    l2_start = 1   # table row index where current L2 block started
    prev_l1  = None
    prev_l2  = None

    for i, (l1, l2, l3, bv, tr) in enumerate(ROWS):
        r_idx = i + 1          # table row index (1-based, row 0 = header)
        row   = table.rows[r_idx]
        set_row_height(row, 1.6)

        # Alternate row tint on the scenario cell
        alt_bg = ROW_ALT if i % 2 == 1 else 'FFFFFF'

        # ── Level-1 cell ─────────────────────────────────────────────────────
        c1 = row.cells[0]
        if l1:
            # New L1 group — close previous merge
            if prev_l1 is not None:
                merge_rows(table, 0, l1_start, r_idx - 1)
            l1_start = r_idx
            prev_l1  = l1
            set_cell_bg(c1, L1_BG)
            cell_para(c1, l1, bold=True, font_size=10,
                      align=WD_ALIGN_PARAGRAPH.CENTER)
        else:
            # Same L1 — cell will be merged later; blank for now
            set_cell_bg(c1, L1_BG)
            cell_para(c1, '', font_size=10)

        # ── Level-2 cell ─────────────────────────────────────────────────────
        c2 = row.cells[1]
        if l2:
            # New L2 — close previous merge
            if prev_l2 is not None:
                merge_rows(table, 1, l2_start, r_idx - 1)
            l2_start = r_idx
            prev_l2  = l2
            set_cell_bg(c2, L2_BG)
            cell_para(c2, l2, bold=True, font_size=10,
                      align=WD_ALIGN_PARAGRAPH.CENTER)
        else:
            set_cell_bg(c2, L2_BG)
            cell_para(c2, '', font_size=10)

        # ── Level-3 scenario ─────────────────────────────────────────────────
        c3 = row.cells[2]
        set_cell_bg(c3, alt_bg)
        cell_para(c3, l3, font_size=9.5)

        # ── Business Value ────────────────────────────────────────────────────
        c4 = row.cells[3]
        set_cell_bg(c4, BV_COLOR.get(bv, 'FFFFFF'))
        cell_para(c4, bv, bold=True, font_size=11,
                  align=WD_ALIGN_PARAGRAPH.CENTER)

        # ── Technical Risk ────────────────────────────────────────────────────
        c5 = row.cells[4]
        set_cell_bg(c5, TR_COLOR.get(tr, 'FFFFFF'))
        cell_para(c5, tr, bold=True, font_size=11,
                  align=WD_ALIGN_PARAGRAPH.CENTER)

    # Close the final L1 and L2 merges
    last = len(ROWS)
    merge_rows(table, 0, l1_start, last)
    merge_rows(table, 1, l2_start, last)

    # ── Save ──────────────────────────────────────────────────────────────────
    doc.save(output_path)
    print(f'Saved: {output_path}')
    print(f'  {n_data} scenario rows across {len(set(r[0] for r in ROWS if r[0]))} quality attributes')


if __name__ == '__main__':
    script_dir  = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(script_dir, 'UTILITY-TREE.docx')
    build_document(output_path)
