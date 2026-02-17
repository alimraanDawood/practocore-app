# Court Officers Implementation Summary

## Overview
I've successfully implemented tools to edit court officers (judges, clerks, registrars, and courts) in a matter, following the pattern established by the matter parties implementation.

## Components Created

### 1. MatterCourtOfficers.vue
**Location:** `/components/shared/Matters/CourtOfficers/MatterCourtOfficers.vue`

**Purpose:** Display court officers for a matter in a Popover (desktop) or Sheet (mobile)

**Features:**
- Shows court information (from relation field)
- Shows judge information (from relation field) 
- Shows custom registrars (from JSON field `courtOfficers.registrars`)
- Shows custom clerks with contact info (from JSON field `courtOfficers.clerks`)
- Responsive design (Popover for tablet+, Sheet for mobile)
- Total officer count display
- Edit button that triggers EditMatterCourtOfficers component

**Data Structure:**
```typescript
matter: {
  court: string,                    // Relation ID to Courts collection
  judges: string,                   // Relation ID to Judges collection (single)
  courtOfficers: {                 // JSON field
    registrars: Array<{
      name: string,
      role?: string
    }>,
    clerks: Array<{
      name: string,
      email?: string,
      phone?: string
    }>
  },
  expand: {
    court: { id, name },            // Expanded court data
    judges: { id, name, expand: { court } }  // Expanded judge data
  }
}
```

### 2. EditMatterCourtOfficers.vue
**Location:** `/components/shared/Matters/CourtOfficers/EditMatterCourtOfficers.vue`

**Purpose:** Edit court officers for an existing matter

**Features:**
- Court selection via CourtSelector (existing component)
- Judge selection via JudgeSelector (existing component, filtered by court)
- Add/remove custom registrars with name and optional role
- Add/remove custom clerks with name, email, and phone
- Validation (all officers must have names)
- Saves to matter via `updateMatter` service
- Emits 'updated' event on success

**Usage:**
```vue
<SharedMattersCourtOfficersEditMatterCourtOfficers 
  :matter="matter"
  @updated="reloadMatter"
>
  <Button>Edit Court Officers</Button>
</SharedMattersCourtOfficersEditMatterCourtOfficers>
```

### 3. CourtOfficers.vue (CreateMatter)
**Location:** `/components/shared/Matters/CreateMatter/CourtOfficers.vue`

**Purpose:** Add custom court officers during matter creation

**Features:**
- Add/remove custom registrars
- Add/remove custom clerks
- v-model support for integration with form
- Generates temporary IDs for new entries
- Emits changes on any field update

**Usage:**
```vue
<FormField name="courtOfficers" v-slot="{ componentField }">
  <FormItem>
    <FormControl>
      <CourtOfficers 
        :modelValue="componentField.modelValue" 
        @update:modelValue="v => setFieldValue('courtOfficers', v)" 
      />
    </FormControl>
  </FormItem>
</FormField>
```

## Integration Points

### 1. Matter Details Page
**File:** `/pages/main/matters/matter/[matterId].vue`

**Change:** Replaced placeholder button with actual component
```vue
<!-- Before -->
<Button size="sm" variant="outline">
  <Gavel />
  Court Officers
</Button>

<!-- After -->
<SharedMattersCourtOfficersMatterCourtOfficers 
  @updated="reloadMatter" 
  :matter="currentMatterOrApplication"
/>
```

### 2. CreateMatter Component
**File:** `/components/shared/Matters/CreateMatter/CreateMatter.vue`

**Changes:**
1. Added CourtOfficers field to form (line ~162-169)
2. Added courtOfficers to createMatter API call (line ~811)

```vue
<!-- Form field -->
<FormField name="courtOfficers" v-slot="{ componentField }">
  <FormItem class="flex flex-col">
    <FormControl>
      <CourtOfficers 
        :modelValue="componentField.modelValue" 
        @update:modelValue="v => setFieldValue('courtOfficers', v)" 
      />
    </FormControl>
  </FormItem>
</FormField>

<!-- API call -->
const result = await createMatter({
  // ...existing fields
  courtOfficers: values.courtOfficers || { registrars: [], clerks: [] },
});
```

## Database Schema

### Pocketbase Collections Used:

1. **Courts** (pbc_2645832791)
   - Fields: id, name, order
   - Used as: Relation field on Matters

2. **Judges** (pbc_830118093)
   - Fields: id, name, court (relation to Courts)
   - Used as: Relation field on Matters (maxSelect: 1)

3. **Registrars** (pbc_2951586174)
   - Fields: id, name, court (relation to Courts), role
   - Note: Not directly linked to Matters, shown via PreviewRegistrarsAndClerks

4. **Clerks** (pbc_1196889990)
   - Fields: id, name, judge (relation to Judges), phone, email
   - Note: Not directly linked to Matters, shown via PreviewRegistrarsAndClerks

5. **Matters** (pbc_3853224427)
   - Existing fields:
     - `court`: relation to Courts (maxSelect: 1)
     - `judges`: relation to Judges (maxSelect: 1)
   - **New field needed**: `courtOfficers` (JSON type)
     - Structure: `{ registrars: [...], clerks: [...] }`

## Important Notes

### Schema Addition Required
The Matters collection needs a new JSON field called `courtOfficers` to store custom registrars and clerks. Add this field in Pocketbase with:
- Type: JSON
- Name: courtOfficers
- Max size: 0 (unlimited)

### Dual Officer System
The implementation supports two types of officers:

1. **Database Officers** (Read-only in forms)
   - Shown by PreviewRegistrarsAndClerks component
   - Automatically linked based on court/judge selection
   - From Registrars and Clerks collections

2. **Custom Officers** (Editable)
   - Stored in JSON field `courtOfficers`
   - User can add/edit/remove
   - Managed by our new components

### Judge Selection Note
The JudgeSelector component uses `multiple` selection mode, but the Matters schema shows `maxSelect: 1` for judges. This may be an intentional design choice (allowing multiple judge selection in UI but storing only one) or an inconsistency to address.

### Existing Services Used
All required API functions already exist in `/services/matters/index.ts`:
- `getCourts(page, perPage, options)`
- `getJudges(page, perPage, options)`
- `getRegistrars(page, perPage, options)`
- `getClerks(page, perPage, options)`
- `updateMatter(matterId, data)`
- `createMatter(options)`

## Testing Checklist

- [ ] Add `courtOfficers` JSON field to Matters collection in Pocketbase
- [ ] Test creating a new matter with custom court officers
- [ ] Test editing court officers on an existing matter
- [ ] Test viewing court officers on matter details page
- [ ] Test responsive behavior (desktop Popover vs mobile Sheet)
- [ ] Verify court/judge selection filters correctly
- [ ] Verify PreviewRegistrarsAndClerks shows database officers
- [ ] Test validation (empty names should prevent saving)
- [ ] Test optional fields (role, email, phone) save correctly
- [ ] Verify matter reload after update shows new data

## UI/UX Features

1. **Responsive Design**
   - Desktop: Popover dropdown
   - Mobile: Bottom sheet

2. **Visual Hierarchy**
   - Court and Judge shown first (primary officers)
   - Registrars and Clerks grouped separately
   - Contact info displayed for clerks

3. **Icons Used**
   - Gavel: Court officers general
   - Building2: Court
   - FileText: Registrars
   - User: Clerks
   - Mail/Phone: Contact info

4. **Edit Controls**
   - Plus button to add officers
   - X button to remove officers
   - Clear validation messages
   - Loading states during save

## Future Enhancements

1. **Search/Autocomplete:** Add autocomplete for registrar/clerk names from database
2. **Bulk Import:** Allow importing multiple officers at once
3. **Templates:** Save common court officer configurations as templates
4. **History:** Track changes to court officers over time
5. **Validation:** Add email format validation and phone number formatting
6. **Database Linking:** Option to save custom officers to database collections for reuse

