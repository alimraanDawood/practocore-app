import * as XLSX from 'xlsx'
import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate'

/** Builds the bulk-invite template from the FIRM'S OWN titles.
 *
 *  This replaces a shared Google Sheet, and the reason is not convenience. A
 *  static template cannot know a firm's titles: a firm that renames Paralegal to
 *  "Legal Assistant" would find its own vocabulary missing from the one document
 *  the product told it to use. It also required a Google account, put colleague
 *  names and addresses into somebody's Drive, and depended on a single doc
 *  staying alive and shared — if it moved, the button broke for everyone at once.
 *
 *  SheetJS's community build does NOT write data validation — verified by writing
 *  a dropdown and reading it back with another library, which found none. Rather
 *  than ship a template without dropdowns, the workbook is post-processed:
 *  an .xlsx is a zip of XML, so the validation is injected into the sheet before
 *  the file is handed over (see withDataValidation).
 */
export interface TemplateRole {
    key: string
    label: string
    description?: string
}

const HEADERS = ['Full Name', 'Email', 'Authority', 'Title']

function headerNotes(defaultTitle: string) {
    return [
        "Required. The person's name as it should appear in the firm.",
        'Required. The invitation is sent to this address.',
        'Member or Admin. Leave blank for Member.\n\n' +
        'An ADMIN administers the firm — billing, membership and settings — and holds ' +
        'every permission regardless of the title in the next column.\n\n' +
        'Owner is not set here: ownership moves by transfer, inside the app.',
        'What this person may do. A title carries a set of permissions, so this is a ' +
        'real grant and not a label.\n\n' +
        'Your firm\'s titles are listed on the Titles sheet.\n\n' +
        `Leave blank and they get the firm's default (${defaultTitle}).`,
    ]
}

export function buildTemplateWorkbook(roles: TemplateRole[]): XLSX.WorkBook {
    const titles = roles.length ? roles : [{ key: 'associate', label: 'Associate' }]
    const defaultTitle = titles.find((r) => r.key === 'associate')?.label ?? titles[0].label

    // ── Invitations ────────────────────────────────────────────────────────
    // Two example rows so the shape is obvious without reading anything. They
    // are meant to be deleted, which the guide says and the Read me repeats.
    const example = [
        HEADERS,
        ['Nakato Kirabo', 'nakato@yourfirm.co.ug', 'Admin', titles[0].label],
        ['James Okello', 'james@yourfirm.co.ug', 'Member', defaultTitle],
    ]
    const invitations = XLSX.utils.aoa_to_sheet(example)
    invitations['!cols'] = [{ wch: 26 }, { wch: 32 }, { wch: 16 }, { wch: 24 }]
    invitations['!freeze'] = { xSplit: '0', ySplit: '1' }

    const notes = headerNotes(defaultTitle)
    HEADERS.forEach((_, index) => {
        const ref = XLSX.utils.encode_cell({ r: 0, c: index })
        const cell = invitations[ref]
        if (!cell) return
        cell.c = cell.c ?? []
        cell.c.push({ a: 'PractoCore', t: notes[index] })
        cell.c.hidden = true
    })

    // ── Titles ─────────────────────────────────────────────────────────────
    // The firm's own, with the description each one carries in the app, so
    // whoever fills the sheet can see what they are handing out.
    const titleRows: string[][] = [['Title', 'What it allows']]
    for (const role of titles) titleRows.push([role.label, role.description ?? ''])
    const titlesSheet = XLSX.utils.aoa_to_sheet(titleRows)
    titlesSheet['!cols'] = [{ wch: 26 }, { wch: 74 }]

    // ── Read me ────────────────────────────────────────────────────────────
    // States the two things that are not guessable and that the old shared
    // template never said anywhere.
    const guide = [
        ['Bulk invite template'],
        [''],
        ['1. Fill in one row per person on the Invitations sheet.'],
        ['2. Delete the two example rows before you import.'],
        ['3. Save as .xlsx or .csv and upload it in Team → Import.'],
        [''],
        ['Authority — who administers the firm'],
        ['Member is the default. An Admin administers the firm: billing, membership and settings.'],
        ['An admin holds EVERY permission regardless of their title, so the Title column stops'],
        ['deciding their access.'],
        ['Owner is not set here — ownership moves by transfer, inside the app.'],
        [''],
        ['Title — what they may do'],
        ['A title carries a set of permissions, so this column is a real grant and not a label.'],
        [`Leaving it blank is not "no permissions": the person gets ${defaultTitle}, and everything`],
        ['that title allows. Your firm\'s titles are on the Titles sheet.'],
        [''],
        ['Nothing in this file grants a permission directly. Change what a title may do in'],
        ['Team → Roles; it applies to everyone who holds that title.'],
    ]
    const guideSheet = XLSX.utils.aoa_to_sheet(guide)
    guideSheet['!cols'] = [{ wch: 96 }]

    // Invitations MUST be first: the importer reads SheetNames[0] and nothing
    // else, so a guide sheet in front of it would be parsed as the data and
    // every row rejected for a missing Email column.
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, invitations, 'Invitations')
    XLSX.utils.book_append_sheet(wb, titlesSheet, 'Titles')
    XLSX.utils.book_append_sheet(wb, guideSheet, 'Read me')
    return wb
}

/** The bytes of the finished template, dropdowns and all. Separated from the
 *  download so it can be round-tripped in a test without touching the DOM. */
export function templateBytes(roles: TemplateRole[]): Uint8Array {
    const wb = buildTemplateWorkbook(roles)
    const raw = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
    return withDataValidation(raw, roles.length || 1)
}

export function downloadTemplate(roles: TemplateRole[], firmName?: string) {
    const bytes = templateBytes(roles)
    const safeName = (firmName ?? 'PractoCore').replace(/[^\w\s-]/g, '').trim() || 'PractoCore'
    // A Blob and an object URL rather than XLSX.writeFile: the bytes have been
    // rewritten since SheetJS produced them, so its own writer is no longer the
    // thing holding the file.
    const blob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${safeName} — bulk invite template.xlsx`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
}

/** Injects real dropdowns into a workbook SheetJS has written.
 *
 *  An .xlsx is a zip of XML parts, and data validation is one element the
 *  community build simply never emits. Everything else it writes is correct, so
 *  the cheaper fix is to add the missing element rather than to change library:
 *  unzip, splice `<dataValidations>` into the first worksheet, rezip.
 *
 *  Placement is not free: the worksheet schema fixes the order of its children,
 *  and `dataValidations` must sit after `sheetData` and before `pageMargins`.
 *  Appending it at the end of the file produces a workbook Excel calls corrupt
 *  and offers to repair, which is a worse outcome than no dropdown at all.
 */
function withDataValidation(buffer: ArrayBuffer, titleCount: number): Uint8Array {
    const zip = unzipSync(new Uint8Array(buffer))
    // Invitations is appended first, and SheetJS numbers the parts in append
    // order, so the data sheet is sheet1.xml.
    const path = 'xl/worksheets/sheet1.xml'
    const sheet = zip[path]
    if (!sheet) return new Uint8Array(buffer)

    let xml = strFromU8(sheet)
    const lastTitleRow = Math.max(2, titleCount + 1)
    const validations =
        '<dataValidations count="2">' +
        // Authority rejects anything else: there are two valid values, both
        // spelled out, so a typo here is a mistake rather than a firm's own word.
        '<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1"' +
        ' errorTitle="Unknown authority" error="Use Member or Admin. Leave blank for Member."' +
        ' promptTitle="Authority" prompt="An admin holds every permission regardless of the title."' +
        ' sqref="C2:C1000"><formula1>"Member,Admin"</formula1></dataValidation>' +
        // Title does NOT reject. The app validates against the firm's live roles,
        // and a spreadsheet that refuses a title the firm actually has is worse
        // than one that passes it through to be checked properly.
        '<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="0"' +
        ' promptTitle="Title" prompt="Your firm&apos;s titles are on the Titles sheet. Blank uses the firm default."' +
        ` sqref="D2:D1000"><formula1>Titles!$A$2:$A$${lastTitleRow}</formula1></dataValidation>` +
        '</dataValidations>'

    if (xml.includes('<pageMargins')) {
        xml = xml.replace('<pageMargins', validations + '<pageMargins')
    } else {
        xml = xml.replace('</worksheet>', validations + '</worksheet>')
    }

    zip[path] = strToU8(xml)
    return zipSync(zip)
}
