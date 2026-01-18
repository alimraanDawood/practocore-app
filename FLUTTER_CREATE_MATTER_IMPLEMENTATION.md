# CreateMatter Form - Flutter Implementation Guide

## Overview

The CreateMatter form is a multi-step wizard for creating legal matters with dynamic template-based fields, party management, court/judge selection, and deadline configuration. This document provides complete implementation guidance for Flutter using shadcn_ui.

---

## Architecture Overview

### Component Type
- **Modal Dialog** (desktop/tablet) OR **Bottom Sheet** (mobile)
- **Multi-step Form** with progressive disclosure
- **Stateful widget** with form state management
- **Responsive design** with mobile-first approach

### Key Features
1. Dynamic step generation based on template configuration and user context
2. Template-driven field rendering
3. Party/representing management (if enabled in template)
4. Court, judge, firm, and opposing counsel selection
5. Real-time form validation
6. Date-based deadline calculations (handled server-side)
7. Member assignment for organization users

---

## Data Models

### 1. Matter Creation Request

```dart
class CreateMatterRequest {
  final String name;                    // Case name (e.g., "Smith v. Jones")
  final String caseNumber;              // Optional case/docket number
  final bool personal;                  // Private matter flag (org users only)
  final List<String> members;           // User IDs for org members
  final String templateId;              // Selected template ID
  final String date;                    // Trigger date (ISO 8601 string)
  final Map<String, dynamic> fieldValues; // Dynamic template field values
  final String? court;                  // Court ID (optional)
  final List<String> judges;            // List of judge IDs
  final String? firm;                   // Firm ID (optional)
  final List<OpposingCounselItem> opposingCounsel; // Opposing lawyers
  final Map<String, List<PartyMember>>? parties;    // Party data by role
  final RepresentingInfo? representing; // Representation configuration
}
```

### 2. Opposing Counsel Item

```dart
class OpposingCounselItem {
  final String id;           // UUID v4
  final String name;         // Required - lawyer name
  final String? email;       // Optional
  final String? phone;       // Optional
  final String? firm;        // Optional - firm/organization name
  final String? address;     // Optional - physical address
}
```

### 3. Party Member

```dart
class PartyMember {
  final String id;           // UUID v4
  final String roleId;       // Role ID from template
  final String roleName;     // Role name (e.g., "Plaintiff")
  final String name;         // Required - party name
  final String type;         // "individual" | "corporate" | "government" | "other"
  final ContactInfo contactInfo; // Optional contact details
}

class ContactInfo {
  final String? email;
  final String? phone;
  final String? address;
}
```

### 4. Representing Info

```dart
class RepresentingInfo {
  final String roleId;              // Role ID being represented
  final List<String> partyMemberIds; // List of party member IDs
}
```

### 5. Template Field Types

```dart
enum TemplateFieldType {
  string,   // Text input
  select,   // Dropdown with options
  boolean,  // Switch/checkbox
  date,     // Date picker
}

class TemplateField {
  final String id;
  final String label;
  final TemplateFieldType type;
  final bool required;
  final String? placeholder;
  final List<FieldOption>? options; // For select type
}

class FieldOption {
  final String value;
  final String label;
}
```

---

## Step Configuration Logic

### Dynamic Steps Based on Context

The form steps change dynamically based on:
1. **User Organization Status**: `hasOrg = user.organisation != null`
2. **Template Party Configuration**: `hasPartyConfig = template.data.parties?.enabled == true`

### Step Sequences

#### Case 1: Organization User + Party Config
```dart
[
  Step 1: Choose Matter Type (matter_type)
  Step 2: Add Parties (parties)
  Step 3: Matter Details (matter_details)
  Step 4: Choose Lawyers (members)
  Step 5: Timeline (field_values)
]
```

#### Case 2: Organization User + No Party Config
```dart
[
  Step 1: Choose Matter Type (matter_type)
  Step 2: Matter Details (matter_details)
  Step 3: Choose Lawyers (members)
  Step 4: Timeline (field_values)
]
```

#### Case 3: Personal User + Party Config
```dart
[
  Step 1: Choose Matter Type (matter_type)
  Step 2: Add Parties (parties)
  Step 3: Matter Details (matter_details)
  Step 4: Timeline (field_values)
]
```

#### Case 4: Personal User + No Party Config
```dart
[
  Step 1: Choose Matter Type (matter_type)
  Step 2: Matter Details (matter_details)
  Step 3: Timeline (field_values)
]
```

---

## Step Implementation Details

### Step 1: Choose Matter Type (matter_type)

**Purpose**: Select a deadline template that defines the matter structure.

**UI Components**:
- Template selector (grid or list view)
- Each template shows:
  - Icon/image
  - Name
  - Description
  - Category/tags

**Validation**:
```dart
final matterTypeSchema = {
  'template': {
    'id': (value) => value != null && value.isNotEmpty
        ? null
        : 'Please select a matter type',
  }
};
```

**Data Binding**:
- Store selected template object with full configuration
- Extract: `template.id`, `template.fields`, `template.triggerDatePrompt`
- Use template config to determine if parties step should appear

**Template Structure Reference**:
```dart
class DeadlineTemplate {
  final String id;
  final String name;
  final String? caseNumberLabel;     // Custom label for case number field
  final String? triggerDatePrompt;   // Custom label for trigger date
  final List<TemplateField> fields;  // Dynamic form fields
  final PartiesConfig? parties;      // Party configuration (optional)
}

class PartiesConfig {
  final bool enabled;                  // Show parties step?
  final List<PartyRole> roles;         // Party roles (Plaintiff, Defendant, etc.)
}

class PartyRole {
  final String id;                     // Unique role ID
  final String name;                   // Role name
  final String side;                   // "first" | "second" (for case name generation)
  final Labels labels;                 // Singular/plural labels
  final MemberCount memberCount;       // Min/max constraints
}

class Labels {
  final String singular;  // e.g., "Plaintiff"
  final String plural;    // e.g., "Plaintiffs"
}

class MemberCount {
  final int minimum;      // Minimum required parties
  final int? maximum;     // Maximum allowed (null = unlimited)
  final int defaultCount; // Default to add
}
```

---

### Step 2: Add Parties (parties) - Conditional

**Show When**: `template.data.parties?.enabled == true`

**Purpose**: Define parties involved in the case and specify which party you represent.

#### UI Structure

```
┌─────────────────────────────────────────────┐
│ Add Parties                                 │
│ Add the parties involved in this matter...  │
├─────────────────────────────────────────────┤
│                                             │
│ ┌─ Plaintiffs (Min: 1) ──────────────────┐ │
│ │ [+ Add Plaintiff]                       │ │
│ │                                         │ │
│ │ ┌─ Party Card ────────────────────────┐ │ │
│ │ │ Name: [___________] [Delete Btn]    │ │ │
│ │ │ Type: [Individual ▼]                │ │ │
│ │ │ [▶ Add Contact Info (Optional)]     │ │ │
│ │ └─────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ┌─ Defendants (Min: 1) ───────────────────┐ │
│ │ [+ Add Defendant]                       │ │
│ │ (Cards similar to above)                │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ┌─ Who are you representing? * ───────────┐ │
│ │ [Select party role ▼]                   │ │
│ │                                         │ │
│ │ Select specific parties:                │ │
│ │ [✓] John Doe (Individual)               │ │
│ │ [ ] Jane Smith (Corporate)              │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

#### Party Management Logic

**Adding a Party**:
```dart
void addPartyMember(String roleId, String roleName) {
  final newMember = PartyMember(
    id: Uuid().v4(),
    roleId: roleId,
    roleName: roleName,
    name: '',
    type: 'individual',
    contactInfo: ContactInfo(),
  );

  // Add to parties map: parties[roleId].add(newMember)
}
```

**Removing a Party**:
```dart
void removePartyMember(String roleId, int index) {
  final memberToRemove = parties[roleId][index];

  // Remove from parties list
  parties[roleId].removeAt(index);

  // Remove from representing if selected
  if (representing?.partyMemberIds.contains(memberToRemove.id) == true) {
    representing.partyMemberIds.remove(memberToRemove.id);
  }
}
```

**Auto-select Representing**:
```dart
void updateRepresentingRole(String roleId) {
  final roleMembers = parties[roleId] ?? [];

  representing = RepresentingInfo(
    roleId: roleId,
    partyMemberIds: roleMembers.map((m) => m.id).toList(),
  );
}
```

#### Auto-generate Case Name

**Logic**: Combine parties from "first" and "second" sides in legal format.

```dart
String generateCaseNameFromParties() {
  const maxPartiesPerSide = 2;
  const maxLengthPerSide = 60;

  final firstSideParties = <String>[];
  final secondSideParties = <String>[];

  // Group parties by side
  for (final role in template.parties.roles) {
    final members = parties[role.id] ?? [];
    final namedMembers = members.where((m) => m.name.trim().isNotEmpty);

    if (role.side == 'first') {
      firstSideParties.addAll(namedMembers.map((m) => m.name.trim()));
    } else if (role.side == 'second') {
      secondSideParties.addAll(namedMembers.map((m) => m.name.trim()));
    }
  }

  final firstFormatted = formatPartyList(firstSideParties);
  final secondFormatted = formatPartyList(secondSideParties);

  if (firstFormatted.isNotEmpty && secondFormatted.isNotEmpty) {
    return '$firstFormatted v. $secondFormatted';
  } else if (firstFormatted.isNotEmpty) {
    return firstFormatted;
  } else if (secondFormatted.isNotEmpty) {
    return secondFormatted;
  }

  return '';
}

String formatPartyList(List<String> parties) {
  if (parties.isEmpty) return '';

  // Truncate if too many parties
  if (parties.length > 2) {
    final remaining = parties.length - 2;
    return '${parties[0]}, ${parties[1]} and $remaining ${remaining == 1 ? 'other' : 'others'}';
  }

  final fullList = parties.join(', ');

  // Truncate if too long
  if (fullList.length > 60 && parties.length > 1) {
    final remaining = parties.length - 1;
    return '${parties[0]} and $remaining ${remaining == 1 ? 'other' : 'others'}';
  }

  return fullList;
}
```

**Auto-fill Trigger**: Update case name field whenever parties change.

#### Validation Rules

```dart
List<String> validateParties() {
  final errors = <String>[];

  // Check minimum count for each role
  for (final role in template.parties.roles) {
    final members = parties[role.id] ?? [];
    if (members.length < role.memberCount.minimum) {
      errors.add(
        '${role.name} requires at least ${role.memberCount.minimum} member(s), '
        'but only ${members.length} provided'
      );
    }

    // Check for empty names
    final emptyNames = members.where((m) => m.name.trim().isEmpty).length;
    if (emptyNames > 0) {
      errors.add('$emptyNames ${role.name} member(s) missing names');
    }
  }

  // Check if representing is set
  final hasParties = parties.values.any((list) => list.isNotEmpty);
  if (hasParties && representing == null) {
    errors.add('Please select which party you are representing');
  }

  if (representing != null && representing.partyMemberIds.isEmpty) {
    errors.add('Please select at least one party member to represent');
  }

  return errors;
}
```

---

### Step 3: Matter Details (matter_details)

**Purpose**: Collect core case information, court details, and opposing counsel.

#### Form Fields

**1. Case Name** (Required)
- **Type**: Text input
- **Label**: "Case Name*"
- **Placeholder**: "A vs B"
- **Validation**: Minimum 3 characters
- **Auto-populated**: From parties (if parties enabled)

**2. Case Number** (Optional)
- **Type**: Text input
- **Label**: Dynamic from `template.caseNumberLabel` or "Case Number"
- **Placeholder**: Empty
- **Validation**: None (optional field)

**3. Make Private** (Organization Users Only)
- **Type**: Switch/Toggle
- **Label**: "Make this Matter Private"
- **Description**: "This will prevent other members of the organisation from viewing this matter."
- **Default**: false
- **Show When**: `user.organisation != null`

**4. Court** (Optional)
- **Type**: Single-select dropdown (searchable)
- **Label**: "Court"
- **Data Source**: `getCourts(page: 1, perPage: 1000)`
- **Display**: Court name
- **Value**: Court ID
- **Component**: Shadcn Combobox or Select

**5. Judges** (Optional)
- **Type**: Multi-select dropdown (searchable)
- **Label**: "Judges"
- **Data Source**: `getJudges(page: 1, perPage: 100, filter: "court = '{courtId}'")`
- **Filter By**: Selected court ID
- **Behavior**:
  - Disabled/empty until court is selected
  - Auto-clears when court changes
- **Display**: Judge name
- **Value**: List of judge IDs

**6. Preview: Registrars & Clerks** (Read-only Display)
- **Show When**: Court and/or judges are selected
- **Purpose**: Show associated registrars and clerks for reference
- **Data Source**:
  - `getRegistrars(filter: "court = '{courtId}' && judges ~ '{judgeId}'")`
  - `getClerks(filter: "court = '{courtId}' && judges ~ '{judgeId}'")`
- **UI**: Compact list/chips showing names
- **Note**: This is informational only, not a form field

**Preview Component Implementation**:
```dart
class PreviewRegistrarsAndClerks extends StatefulWidget {
  final String? courtId;
  final List<String> judgeIds;

  // Fetches and displays registrars and clerks
  // Shows loading state while fetching
  // Renders as compact chips or list items
}
```

**7. Firm** (Optional)
- **Type**: Single-select dropdown (searchable)
- **Label**: "Firm"
- **Data Source**: `getFirms(page: 1, perPage: 1000)`
- **Display**: Firm name
- **Value**: Firm ID
- **Component**: Shadcn Combobox

**8. Opposing Counsel** (Optional List)
- **Type**: Dynamic list with add/remove
- **Component**: Custom OpposingCounsel widget
- **Initial State**: Empty array
- **Add Button**: "Add Lawyer"

#### Opposing Counsel Item Structure

Each opposing counsel entry contains:

```
┌─ Opposing Counsel Item ──────────────────────┐
│ Name: [_______________] [Delete Icon Button] │
│                                              │
│ Email:         Phone:                        │
│ [___________]  [___________]                 │
│                                              │
│ Firm/Organization:                           │
│ [_____________________]                      │
│                                              │
│ Address:                                     │
│ [_____________________]                      │
└──────────────────────────────────────────────┘
```

**Opposing Counsel Validation**:
```dart
List<String> validateOpposingCounsel(List<OpposingCounselItem> counsel) {
  final errors = <String>[];

  if (counsel.isEmpty) return errors; // Optional, so empty is OK

  final emptyNames = counsel.where((c) => c.name.trim().isEmpty).length;
  if (emptyNames > 0) {
    errors.add('$emptyNames lawyer(s) missing names');
  }

  return errors;
}
```

#### Matter Details Validation Schema

```dart
final matterDetailsSchema = {
  'name': (value) {
    if (value == null || value.isEmpty) {
      return 'Case name is required';
    }
    if (value.length < 3) {
      return 'You need at least 3 characters for a valid name!';
    }
    return null;
  },
  'caseNumber': (value) => null, // Optional
  'personal': (value) => null,   // Optional boolean
  'court': (value) => null,      // Optional
  'judges': (value) => null,     // Optional array
  'firm': (value) => null,       // Optional
  'opposingCounsel': (value) => null, // Optional array with nested validation
};
```

---

### Step 4: Choose Lawyers (members) - Organization Users Only

**Show When**: `user.organisation != null`

**Purpose**: Select organization members who can access and receive notifications about this matter.

**UI Components**:
- Member selector (multi-select list with avatars)
- Search/filter functionality
- Selected members chips/tags

**Data Source**:
```dart
// Fetch organization members
final members = await getOrganisationMembers(organisationId);
```

**Display Each Member**:
- Avatar/profile picture
- Name
- Email or role
- Checkbox for selection

**Validation**: None (optional field)

**Data Binding**: Store array of selected user IDs

---

### Step 5: Timeline (field_values)

**Purpose**: Collect template-specific dynamic fields and trigger date.

#### Dynamic Field Rendering

**Field Order**:
1. **Trigger Date Field** (Always first, always required)
2. **Template-defined fields** (Order as defined in template)

#### Trigger Date Field

```dart
TemplateField(
  id: 'date',
  label: template.triggerDatePrompt ?? 'Enter Date',
  type: TemplateFieldType.date,
  required: true,
)
```

**Component**: Shadcn Date Picker
**Validation**: Required
**Format**: ISO 8601 string (e.g., "2024-01-15")

#### Dynamic Field Types

**A. String Field**
```dart
if (field.type == TemplateFieldType.string) {
  return TextFormField(
    decoration: InputDecoration(
      labelText: field.label,
      hintText: field.placeholder ?? '',
    ),
    validator: (value) {
      if (field.required && (value == null || value.isEmpty)) {
        return '${field.label} is required';
      }
      return null;
    },
  );
}
```

**B. Select Field**
```dart
if (field.type == TemplateFieldType.select) {
  return DropdownButtonFormField<String>(
    decoration: InputDecoration(
      labelText: field.label,
    ),
    items: field.options?.map((opt) {
      return DropdownMenuItem(
        value: opt.value,
        child: Text(opt.label),
      );
    }).toList(),
    validator: (value) {
      if (field.required && (value == null || value.isEmpty)) {
        return 'Please select ${field.label}';
      }
      return null;
    },
  );
}
```

**C. Boolean Field**
```dart
if (field.type == TemplateFieldType.boolean) {
  return SwitchListTile(
    title: Text(field.label),
    value: formValues[field.id] ?? false,
    onChanged: (value) {
      setState(() {
        formValues[field.id] = value;
      });
    },
  );
}
```

**D. Date Field**
```dart
if (field.type == TemplateFieldType.date) {
  return DatePickerFormField(
    labelText: field.label,
    validator: (value) {
      if (field.required && value == null) {
        return 'A date is required';
      }
      return null;
    },
    onChanged: (date) {
      formValues[field.id] = date.toIso8601String();
    },
  );
}
```

#### Field Values Structure

Store all dynamic field values in a map:

```dart
final Map<String, dynamic> fieldValues = {
  'date': '2024-01-15',           // Trigger date (always present)
  'fieldId1': 'some value',       // String field
  'fieldId2': true,               // Boolean field
  'fieldId3': 'option2',          // Select field
  'fieldId4': '2024-02-01',       // Date field
};
```

#### Timeline Validation

```dart
Map<String, String> validateFieldValues() {
  final errors = <String, String>{};

  // Always validate trigger date
  if (fieldValues['date'] == null || fieldValues['date'].isEmpty) {
    errors['date'] = 'A date is required.';
  }

  // Validate each template field
  for (final field in templateFields) {
    if (field.required) {
      final value = fieldValues[field.id];

      switch (field.type) {
        case TemplateFieldType.string:
        case TemplateFieldType.select:
          if (value == null || value.toString().isEmpty) {
            errors[field.id] = '${field.label} is required';
          }
          break;
        case TemplateFieldType.boolean:
          // Booleans are always valid (true/false)
          break;
        case TemplateFieldType.date:
          if (value == null || value.toString().isEmpty) {
            errors[field.id] = '${field.label} is required';
          }
          break;
      }
    }
  }

  return errors;
}
```

---

## Navigation & Step Management

### Step State

```dart
class CreateMatterFormState {
  int currentStepIndex = 0;
  List<FormStep> steps = [];

  // Step IDs
  static const stepMatterType = 'matter_type';
  static const stepParties = 'parties';
  static const stepMatterDetails = 'matter_details';
  static const stepMembers = 'members';
  static const stepFieldValues = 'field_values';
}
```

### Step Navigation Logic

```dart
bool canGoNext() {
  // Check if current step is valid
  switch (steps[currentStepIndex].id) {
    case stepMatterType:
      return selectedTemplate != null;
    case stepParties:
      return validateParties().isEmpty;
    case stepMatterDetails:
      return validateMatterDetails().isEmpty;
    case stepMembers:
      return true; // Members are optional
    case stepFieldValues:
      return validateFieldValues().isEmpty;
    default:
      return false;
  }
}

bool canGoPrev() {
  return currentStepIndex > 0;
}

void nextStep() {
  if (canGoNext() && currentStepIndex < steps.length - 1) {
    setState(() {
      currentStepIndex++;
    });
  }
}

void prevStep() {
  if (canGoPrev()) {
    setState(() {
      currentStepIndex--;
    });
  }
}
```

### Submit Button Logic

```dart
Widget buildActionButtons() {
  final isLastStep = currentStepIndex == steps.length - 1;

  return Row(
    mainAxisAlignment: MainAxisAlignment.spaceBetween,
    children: [
      // Back button
      OutlinedButton(
        onPressed: canGoPrev() ? prevStep : null,
        child: Text('Back'),
      ),

      // Next or Submit button
      if (!isLastStep)
        ElevatedButton(
          onPressed: canGoNext() ? nextStep : null,
          child: Text('Next'),
        )
      else
        ElevatedButton(
          onPressed: canGoNext() ? onSubmit : null,
          child: isLoading
            ? CircularProgressIndicator()
            : Text('Create Matter'),
        ),
    ],
  );
}
```

---

## Form Submission

### Submission Flow

```dart
Future<void> onSubmit() async {
  // Validate all steps one final time
  if (!validateAllSteps()) {
    showError('Please fix validation errors before submitting');
    return;
  }

  setState(() {
    isLoading = true;
  });

  try {
    // Clean up party data (remove UI-specific fields)
    final cleanedParties = <String, List<Map<String, dynamic>>>{};
    if (parties != null) {
      for (final entry in parties.entries) {
        cleanedParties[entry.key] = entry.value.map((member) => {
          'id': member.id,
          'role_id': member.roleId,
          'name': member.name,
          'type': member.type,
          'contact_info': member.contactInfo.toJson(),
        }).toList();
      }
    }

    // Build request
    final request = CreateMatterRequest(
      name: caseName,
      caseNumber: caseNumber ?? '',
      personal: personal,
      members: selectedMemberIds,
      templateId: selectedTemplate.id,
      date: fieldValues['date'],
      fieldValues: fieldValues,
      court: selectedCourtId,
      judges: selectedJudgeIds,
      firm: selectedFirmId,
      opposingCounsel: opposingCounselList,
      parties: template.parties?.enabled == true ? cleanedParties : null,
      representing: template.parties?.enabled == true ? representing : null,
    );

    // Call service
    final result = await createMatter(request);

    if (result.success) {
      showSuccess('Matter Created Successfully!');
      Navigator.pop(context, result.data); // Return created matter
    } else {
      showError(result.error ?? 'Unable to create matter at this time!');
    }
  } catch (e) {
    print('Error creating matter: $e');
    showError('Unable to create matter at this time!');
  } finally {
    setState(() {
      isLoading = false;
    });
  }
}
```

### Request Payload Structure

**Final JSON sent to backend**:
```json
{
  "name": "Smith v. Jones",
  "caseNumber": "CV-2024-001",
  "personal": false,
  "members": ["user-id-1", "user-id-2"],
  "templateId": "template-123",
  "date": "2024-01-15",
  "fieldValues": {
    "date": "2024-01-15",
    "field1": "value1",
    "field2": true
  },
  "court": "court-id-123",
  "judges": ["judge-id-1", "judge-id-2"],
  "firm": "firm-id-456",
  "opposingCounsel": [
    {
      "id": "uuid-v4",
      "name": "John Doe",
      "email": "john@lawfirm.com",
      "phone": "+256700000000",
      "firm": "Doe & Associates",
      "address": "123 Legal Street"
    }
  ],
  "parties": {
    "role-plaintiff-id": [
      {
        "id": "uuid-v4",
        "role_id": "role-plaintiff-id",
        "name": "Jane Smith",
        "type": "individual",
        "contact_info": {
          "email": "jane@email.com",
          "phone": "+256700111111"
        }
      }
    ],
    "role-defendant-id": [
      {
        "id": "uuid-v4",
        "role_id": "role-defendant-id",
        "name": "Acme Corp",
        "type": "corporate",
        "contact_info": {}
      }
    ]
  },
  "representing": {
    "role_id": "role-plaintiff-id",
    "party_member_ids": ["uuid-v4"]
  }
}
```

---

## UI/UX Patterns

### Mobile vs Desktop Layout

**Mobile** (< 800px width):
- Bottom sheet presentation
- Single column layout
- Step progress indicator at top (text: "Step X of Y")
- Larger touch targets
- Stack form fields vertically

**Desktop/Tablet** (>= 800px width):
- Dialog modal (max-width: 4xl ≈ 896px)
- Sidebar stepper navigation (left side, 200px wide)
- Two-column layout for some fields
- Smaller, denser form elements

### Step Indicator Components

**Mobile Header**:
```dart
Column(
  crossAxisAlignment: CrossAxisAlignment.start,
  children: [
    Text(
      'Step ${currentStepIndex + 1} of ${steps.length}',
      style: TextStyle(fontWeight: FontWeight.w600),
    ),
    Text(
      steps[currentStepIndex].title,
      style: TextStyle(fontSize: 14),
    ),
  ],
)
```

**Desktop Sidebar**:
```dart
ListView.builder(
  itemCount: steps.length,
  itemBuilder: (context, index) {
    final step = steps[index];
    final isActive = currentStepIndex == index;
    final isCompleted = currentStepIndex > index;

    return ListTile(
      leading: CircleAvatar(
        backgroundColor: isCompleted || isActive
          ? Colors.blue
          : Colors.grey,
        child: isCompleted
          ? Icon(Icons.check, size: 20)
          : Text('${index + 1}'),
      ),
      title: Text(
        step.title,
        style: TextStyle(
          color: isActive ? Colors.blue : Colors.black,
          fontWeight: isActive ? FontWeight.w600 : FontWeight.normal,
        ),
      ),
      onTap: isCompleted ? () => goToStep(index) : null,
    );
  },
)
```

### Form Field Styling

Use shadcn_ui components:
- `TextFormField` with shadcn styling
- `DropdownButtonFormField` or shadcn Select
- `SwitchListTile` with material styling
- `DatePickerFormField` (custom or material)

**Consistent spacing**: 16px between form fields

**Label style**: Medium weight, 14px font size

**Helper text**: Light weight, 12px font size, muted color

---

## Service Integration

### Backend Endpoints (Reference Only)

Your Flutter app should call these endpoints using the ported service logic:

1. **Create Matter**
   - **Endpoint**: `POST /api/practocore/create-matter`
   - **Service Function**: `createMatter(request)`
   - **Returns**: Created matter object with deadlines

2. **Get Courts**
   - **Endpoint**: PocketBase `Courts` collection
   - **Service Function**: `getCourts(page, perPage, options)`

3. **Get Judges**
   - **Endpoint**: PocketBase `Judges` collection
   - **Service Function**: `getJudges(page, perPage, options)`
   - **Filter**: `"court = '{courtId}'"`

4. **Get Registrars**
   - **Endpoint**: PocketBase `Registrars` collection
   - **Service Function**: `getRegistrars(page, perPage, options)`

5. **Get Clerks**
   - **Endpoint**: PocketBase `Clerks` collection
   - **Service Function**: `getClerks(page, perPage, options)`

6. **Get Firms**
   - **Endpoint**: PocketBase `Firms` collection
   - **Service Function**: `getFirms(page, perPage, options)`

7. **Get Organization Members**
   - **Endpoint**: PocketBase `Users` collection
   - **Service Function**: `getOrganisationMembers(orgId)`
   - **Filter**: `"organisation = '{orgId}'"`

### Service Method Signatures (Reference)

```typescript
// From services/matters/index.ts (already ported)

createMatter(options: CreateMatterOptions): Promise<Matter>

getCourts(page: number, perPage: number, options: any): Promise<ListResult<Court>>

getJudges(page: number, perPage: number, options: any): Promise<ListResult<Judge>>

getRegistrars(page: number, perPage: number, options: any): Promise<ListResult<Registrar>>

getClerks(page: number, perPage: number, options: any): Promise<ListResult<Clerk>>

getFirms(page: number, perPage: number, options: any): Promise<ListResult<Firm>>
```

---

## State Reset Logic

### On Dialog Close

```dart
void resetForm() {
  setState(() {
    currentStepIndex = 0;
    selectedTemplate = null;
    caseName = '';
    caseNumber = '';
    personal = false;
    selectedMemberIds = [];
    fieldValues = {};
    selectedCourtId = null;
    selectedJudgeIds = [];
    selectedFirmId = null;
    opposingCounselList = [];
    parties = {};
    representing = null;
  });
}

@override
void dispose() {
  resetForm();
  super.dispose();
}
```

### On Template Change

```dart
void onTemplateSelected(DeadlineTemplate template) {
  setState(() {
    selectedTemplate = template;

    // Reset dependent state
    fieldValues = {};
    parties = {};
    representing = null;

    // Rebuild steps based on new template
    steps = buildSteps();
  });
}
```

---

## Error Handling

### Validation Error Display

**Inline Field Errors**: Show below each field using shadcn form error pattern

**Step-level Errors**: Show at bottom of step (for parties validation)

```dart
if (validationErrors.isNotEmpty) {
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: validationErrors.map((error) {
      return Padding(
        padding: EdgeInsets.only(top: 4),
        child: Text(
          '• $error',
          style: TextStyle(
            color: Colors.red,
            fontSize: 12,
          ),
        ),
      );
    }).toList(),
  );
}
```

### Network Error Handling

```dart
try {
  await createMatter(request);
} on NetworkException catch (e) {
  showError('Network error: ${e.message}');
} on AuthException catch (e) {
  showError('Authentication error: Please log in again');
} on ValidationException catch (e) {
  showError('Validation error: ${e.message}');
} catch (e) {
  showError('Unexpected error: $e');
}
```

---

## Performance Considerations

### Lazy Loading

- **Don't fetch all data upfront**: Load courts/judges/firms only when user reaches matter_details step
- **Cache template list**: Store templates locally to avoid refetching

### Debouncing

- **Auto-generate case name**: Debounce party name input (300ms) before regenerating case name
- **Search filters**: Debounce court/judge/firm search inputs

### Optimization

```dart
// Fetch data only when step is visible
@override
void didUpdateWidget(covariant CreateMatterForm oldWidget) {
  super.didUpdateWidget(oldWidget);

  if (currentStepIndex == matterDetailsStepIndex && !dataLoaded) {
    _fetchMatterDetailsData();
    dataLoaded = true;
  }
}

Future<void> _fetchMatterDetailsData() async {
  final futures = await Future.wait([
    getCourts(1, 1000, {}),
    getFirms(1, 1000, {}),
  ]);

  setState(() {
    courts = futures[0].items;
    firms = futures[1].items;
  });
}
```

---

## Accessibility

### Screen Reader Support

- Label all form fields properly
- Use semantic widgets
- Provide error announcements

### Keyboard Navigation

- Tab order follows visual order
- Enter key submits current step (or moves to next)
- Escape key closes dialog

### Focus Management

```dart
// Focus first field when step changes
void onStepChanged(int newIndex) {
  setState(() {
    currentStepIndex = newIndex;
  });

  // Focus first focusable field in new step
  WidgetsBinding.instance.addPostFrameCallback((_) {
    final firstField = FocusScope.of(context).firstChild;
    if (firstField != null) {
      FocusScope.of(context).requestFocus(firstField);
    }
  });
}
```

---

## Testing Considerations

### Unit Tests

1. **Step generation logic**: Test all 4 step sequence cases
2. **Case name generation**: Test party truncation logic
3. **Validation logic**: Test each validation rule
4. **Party management**: Test add/remove/update operations

### Integration Tests

1. **Full form flow**: Complete form submission with all fields
2. **Dynamic template rendering**: Test with different template configurations
3. **Party step**: Add parties, select representing, verify case name
4. **Error handling**: Test network failures, validation errors

### Widget Tests

1. **Step navigation**: Test next/prev buttons, step indicators
2. **Form field rendering**: Test each field type renders correctly
3. **Conditional rendering**: Test party step visibility, member step visibility
4. **Mobile/desktop layouts**: Test responsive behavior

---

## Implementation Checklist

### Phase 1: Core Structure
- [ ] Create StatefulWidget with modal/sheet presentation
- [ ] Implement step state management
- [ ] Build step generation logic
- [ ] Create navigation controls (next/prev/submit)
- [ ] Add step indicator UI (mobile + desktop)

### Phase 2: Step 1 - Matter Type
- [ ] Create template selector UI
- [ ] Implement template selection handler
- [ ] Add validation for template selection

### Phase 3: Step 2 - Parties (Conditional)
- [ ] Create party role sections
- [ ] Implement add/remove party logic
- [ ] Build party member form fields
- [ ] Create representing selector
- [ ] Implement case name auto-generation
- [ ] Add party validation

### Phase 4: Step 3 - Matter Details
- [ ] Add case name field
- [ ] Add case number field
- [ ] Add personal toggle (org users)
- [ ] Implement court selector with search
- [ ] Implement judge multi-selector (filtered by court)
- [ ] Create registrars/clerks preview component
- [ ] Implement firm selector
- [ ] Create opposing counsel list component
- [ ] Add opposing counsel CRUD operations

### Phase 5: Step 4 - Members (Organization)
- [ ] Fetch organization members
- [ ] Create member selector UI
- [ ] Implement member selection logic

### Phase 6: Step 5 - Timeline
- [ ] Render trigger date field
- [ ] Implement dynamic field renderer
- [ ] Add field type handlers (string, select, boolean, date)
- [ ] Implement field validation
- [ ] Store field values in map

### Phase 7: Submission & Integration
- [ ] Build final request payload
- [ ] Implement createMatter service call
- [ ] Add success/error handling
- [ ] Implement form reset logic
- [ ] Add loading states

### Phase 8: Polish
- [ ] Add responsive layouts (mobile/desktop)
- [ ] Implement proper spacing/styling
- [ ] Add animations/transitions
- [ ] Improve error messages
- [ ] Add accessibility features
- [ ] Optimize performance (lazy loading, debouncing)

---

## Common Pitfalls & Solutions

### Pitfall 1: Court/Judge Dependency
**Problem**: User selects judges, then changes court. Judges from old court still selected.

**Solution**: Clear judge selection when court changes.
```dart
void onCourtChanged(String? courtId) {
  setState(() {
    selectedCourtId = courtId;
    selectedJudgeIds = []; // Clear judges
  });

  if (courtId != null) {
    _loadJudgesForCourt(courtId);
  }
}
```

### Pitfall 2: Party State Sync
**Problem**: Removing a party from list but not from representing selection.

**Solution**: Always update representing when removing parties (see removePartyMember implementation above).

### Pitfall 3: Template Field IDs
**Problem**: Field IDs from template don't match form state keys.

**Solution**: Always use `field.id` as the key in fieldValues map, never field.label or field.name.

### Pitfall 4: Date Format Mismatch
**Problem**: Date picker returns DateTime, backend expects ISO string.

**Solution**: Always convert to ISO 8601 string:
```dart
fieldValues['date'] = selectedDate.toIso8601String();
```

### Pitfall 5: Step Validation on Back
**Problem**: User can't go back if current step is invalid.

**Solution**: Allow back navigation always, validate only on next/submit.

---

## Advanced Features (Optional)

### Auto-save Draft
Store form state in local storage/cache, restore on app restart.

### Duplicate Detection
Warn user if similar case name exists before submission.

### Template Preview
Show template details/deadline structure before selection.

### Bulk Party Import
Allow CSV import for multiple parties.

### Custom Field Types
Support additional field types (time, number, multi-select, etc.).

---

## Debugging Tips

### Print State on Each Step
```dart
void printFormState() {
  print('=== Form State ===');
  print('Current Step: ${steps[currentStepIndex].title}');
  print('Template: ${selectedTemplate?.name}');
  print('Case Name: $caseName');
  print('Parties: ${parties.length} roles');
  print('Field Values: $fieldValues');
}
```

### Validate Request Before Send
```dart
void validateRequest(CreateMatterRequest request) {
  assert(request.name.isNotEmpty, 'Name is required');
  assert(request.templateId.isNotEmpty, 'Template ID is required');
  assert(request.fieldValues.containsKey('date'), 'Trigger date is required');

  if (template.parties?.enabled == true) {
    assert(request.parties != null, 'Parties required for this template');
    assert(request.representing != null, 'Representing required');
  }
}
```

---

## Summary

This implementation guide covers the complete CreateMatter form system for Flutter. Key takeaways:

1. **Dynamic Multi-step Form**: Steps change based on template and user context
2. **Template-driven Fields**: Render forms dynamically from template configuration
3. **Complex State Management**: Party management, representing selection, field values
4. **Comprehensive Validation**: Step-level and field-level validation
5. **Rich Form Components**: Court/judge selection, opposing counsel, dynamic fields
6. **Responsive Design**: Mobile-first with desktop enhancements
7. **Integration Ready**: Clear service layer boundaries with existing backend

Follow the implementation checklist, reference the logic patterns provided, and test each step thoroughly. The form should provide a smooth, intuitive experience for creating legal matters with all necessary information.

---

**Document Version**: 1.0
**Last Updated**: 2026-01-07
**Target Platform**: Flutter with shadcn_ui by mariuti