export interface Member {
    id: string
    name: string
    email: string
    avatar: string
    role: 'admin' | 'lawyer' | 'paralegal' | 'staff',
    organisationRole: 'partner' | 'senior_associate' | 'associate' | 'paralegal' | 'intern'
    verified: boolean
    created: string
    updated: string
    activeMatters?: { id: string; name: string }[]
    nextDeadline?: { name: string; date: string } | null
}

export interface MembersResponse {
    members: Member[]
    total: number
}

export function getOrganisationRoleString(role: string) {
    switch (role) {
        case 'partner':
            return 'Partner';
        case 'senior_associate':
            return 'Senior Associate';
        case 'associate':
            return 'Associate';
        case 'paralegal':
            return 'Paralegal';
        case 'intern':
            return 'Intern';
        default:
            return role;
    }
}