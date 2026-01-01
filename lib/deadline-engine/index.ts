// the interface our deadline engine uses
import jsonLogic from 'json-logic-js';
import _ from 'lodash';

export interface DeadlineTemplate {
    id: string;
    name?: string;
    version: string;
    author?: string;
    description?: string;


    data: {
        fields: DeadlineTemplateField[],
        holidays: {
            name: string;
            date: string;
        }[],
        deadDays?: {
            name: string;
            date: string;
        }[],
        parties: PartyConfig,
        triggerDateRules: {
            allowHolidays: boolean;
            allowWeekends: boolean;
        },
        triggerDatePrompt: string;
        triggerDateName: string;
        deadlines: DeadlineTemplateDeadLine[];
        meta?: any;
    }
}

interface DeadlineTemplateDeadLine {
    id: string;
    name: string;
    dynamic: boolean;
    dependency: {
        targetId: string;
        conditions?: {
            enabled: boolean;
            conditions: {
                enabled: boolean,
                rules: any,
                targetId: string,
            }[]
        }
    },
    offset: {
        dateRules: OffsetDateRules,
        countingRules: OffsetCountingRules,
        days: number; // taken as default offset for failed conditions
        conditions?: {
            enabled: boolean;
            conditions: {
                enabled: boolean;
                rules: any;
                offset: number; // override the default if this condition is fulfilled
            }[]; //json logic condition
        }
    }
    prompts: {
        fulfilled: string;
        input: string;
        pending: string;
        overdue: string;
    },
    applications?: {
        enabled: boolean;
        conditions: {
            rules: any;
        }
    },
    reminders: {}[],
    type: "offset"
}

interface DeadlineTemplateField {
    id: string;
    type: "text" | "number" | "boolean" | "select" | "date";
    name: string;
    label?: string;
    required: boolean;
    defaultValue?: any;
    meta?: any;
}

interface OffsetDateRules {
    allowHolidays: boolean;
    allowWeekends: boolean;
    adjustmentDirection: "forward" | "backward"
}

interface OffsetCountingRules {
    ignoreHolidays: boolean;
    ignoreWeekends: boolean;
    includeFirst: boolean;
}

// parties are members of a matter
interface PartyRole {
    id: string;
    name: string;
    side: "first" | "second";
    labels: {
        singular: string;
        plural: string;
    };
    memberCount: {
        minimum: number;
        maximum: number | null;
        default: number;
    }
}

// Party Config
interface PartyConfig {
    enabled: boolean;
    roles: PartyRole[];
    allowMultiplePerRole: boolean;
    representationRequired: boolean;
}

export interface DeadlineEngineDeadline {
    id: string;
    name?: string;
    date: string;
    status: "pending" | "fulfilled" | "overdue";
    dependency: {
        targetId: string;
    }
}

export interface DeadlineEngineOutput {
    triggerDate: string;
    deadlines: DeadlineEngineDeadline[];
    fieldValues: Record<string, any>;
    events: {}[];
    warnings: string[];
    adjournments: Adjournment[];
    generatedAt: string;
    templateId: string;
    templateVersion: string;

    subProcesses: {
        id: string;
        name: string;
        template: DeadlineTemplate;
        output: DeadlineEngineOutput;
    }[];
}

export interface Adjournment {
    id: string;
    targetId: string;
    from: string;
    to: string;
}

export interface DeadlineEngineAction {
    action: "NULL";
    meta: Object;
}


export interface DeadlineEngineFulfillAction {
    action: "FULFILL";
    meta: {
        targetId: string;
        fulfilledDate: string;
    }
}

export interface DeadlineEngineRecalculateAction {
    action: "RECALCULATE";
    meta: {
        targetId: string;
        fieldValues?: Record<string, any>;
        triggerDate?: string;
    }
}

export interface  DeadlineEngineAdjournAction {
    action: "ADJOURN";
    meta: {
        targetId: string;
        adjournedDate: string;
        force?: boolean; // whether to force even when invalid
        reason?: string;
    }
}

export interface DeadlineEngineSpawnAction {
    action: "SPAWN";
    meta: {
        targetId: string; // id we shall use to chain our deadlines to
        template: DeadlineTemplate; // we must pass our template directly into the action
        fieldValues?: Record<string, any>; // field values must also be provided
    }
}


export class DeadlineEngine {
    private static readonly TRIGGER_ID = "_trigger_";
    private static readonly DEADLINE_PREFIX = "d_";
    private static readonly FIELD_PREFIX = "f_";
    private static readonly REMINDER_PREFIX = "r_";

    static {
        /**
         * Check if date1 is after date2
         * Usage: {"dateAfter": [date1, date2]}
         */
        jsonLogic.add_operation('dateAfter', (date1: any, date2: any) => {
            return new Date(date1) > new Date(date2);
        });

        /**
         * Check if date1 is before date2
         * Usage: {"dateBefore": [date1, date2]}
         */
        jsonLogic.add_operation('dateBefore', (date1: any, date2: any) => {
            return new Date(date1) < new Date(date2);
        });

        /**
         * Check if date1 equals date2 (same day, ignoring time)
         * Usage: {"dateEquals": [date1, date2]}
         */
        jsonLogic.add_operation('dateEquals', (date1: any, date2: any) => {
            const d1 = new Date(date1).toISOString().split('T')[0];
            const d2 = new Date(date2).toISOString().split('T')[0];
            return d1 === d2;
        });

        /**
         * Check if date is between start and end (inclusive)
         * Usage: {"dateBetween": [date, startDate, endDate]}
         */
        jsonLogic.add_operation('dateBetween', (date: any, start: any, end: any) => {
            const d = new Date(date);
            const s = new Date(start);
            const e = new Date(end);
            return d >= s && d <= e;
        });

        // ============================================
        // RELATIVE DATE CALCULATIONS
        // ============================================

        /**
         * Calculate days between two dates (always positive)
         * Usage: {"daysBetween": [date1, date2]}
         */
        jsonLogic.add_operation('daysBetween', (date1: any, date2: any) => {
            const d1 = new Date(date1);
            const d2 = new Date(date2);
            const diffTime = Math.abs(d2.getTime() - d1.getTime());
            return Math.floor(diffTime / (1000 * 60 * 60 * 24));
        });

        /**
         * Calculate days FROM date1 TO date2 (can be negative if date2 is before date1)
         * Usage: {"daysFrom": [date1, date2]}
         */
        jsonLogic.add_operation('daysFrom', (date1: any, date2: any) => {
            const d1 = new Date(date1);
            const d2 = new Date(date2);
            const diffTime = d2.getTime() - d1.getTime();
            return Math.floor(diffTime / (1000 * 60 * 60 * 24));
        });

        /**
         * Calculate days until a future date from reference date (positive if future, negative if past)
         * Usage: {"daysUntil": [referenceDate, targetDate]}
         */
        jsonLogic.add_operation('daysUntil', (fromDate: any, toDate: any) => {
            const from = new Date(fromDate);
            const to = new Date(toDate);
            const diffTime = to.getTime() - from.getTime();
            return Math.floor(diffTime / (1000 * 60 * 60 * 24));
        });

        /**
         * Calculate days since a past date from reference date (positive if past, negative if future)
         * Usage: {"daysSince": [referenceDate, pastDate]}
         */
        jsonLogic.add_operation('daysSince', (fromDate: any, pastDate: any) => {
            const from = new Date(fromDate);
            const past = new Date(pastDate);
            const diffTime = from.getTime() - past.getTime();
            return Math.floor(diffTime / (1000 * 60 * 60 * 24));
        });

        /**
         * Check if targetDate is within N days of referenceDate (past or future)
         * Usage: {"withinDays": [referenceDate, targetDate, days]}
         */
        jsonLogic.add_operation('withinDays', (refDate: any, targetDate: any, days: number) => {
            const ref = new Date(refDate);
            const target = new Date(targetDate);
            const diffTime = Math.abs(target.getTime() - ref.getTime());
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            return diffDays <= days;
        });

        /**
         * Check if targetDate is beyond N days from referenceDate (past or future)
         * Usage: {"beyondDays": [referenceDate, targetDate, days]}
         */
        jsonLogic.add_operation('beyondDays', (refDate: any, targetDate: any, days: number) => {
            const ref = new Date(refDate);
            const target = new Date(targetDate);
            const diffTime = Math.abs(target.getTime() - ref.getTime());
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            return diffDays > days;
        });

        /**
         * Check if targetDate is within N days in the FUTURE from referenceDate
         * Usage: {"withinNextDays": [referenceDate, targetDate, days]}
         */
        jsonLogic.add_operation('withinNextDays', (refDate: any, targetDate: any, days: number) => {
            const ref = new Date(refDate);
            const target = new Date(targetDate);
            const diffTime = target.getTime() - ref.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            return diffDays >= 0 && diffDays <= days;
        });

        /**
         * Check if targetDate is within N days in the PAST from referenceDate
         * Usage: {"withinLastDays": [referenceDate, targetDate, days]}
         */
        jsonLogic.add_operation('withinLastDays', (refDate: any, targetDate: any, days: number) => {
            const ref = new Date(refDate);
            const target = new Date(targetDate);
            const diffTime = ref.getTime() - target.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            return diffDays >= 0 && diffDays <= days;
        });

        // ============================================
        // DAY OF WEEK OPERATIONS
        // ============================================

        /**
         * Get day of week (0 = Sunday, 6 = Saturday)
         * Usage: {"dayOfWeek": [date]}
         */
        jsonLogic.add_operation('dayOfWeek', (date: any) => {
            return new Date(date).getUTCDay();
        });

        /**
         * Check if date is a weekend (Saturday or Sunday)
         * Usage: {"isWeekend": [date]}
         */
        jsonLogic.add_operation('isWeekend', (date: any) => {
            const day = new Date(date).getUTCDay();
            return day === 0 || day === 6;
        });

        /**
         * Check if date is a weekday (Monday-Friday)
         * Usage: {"isWeekday": [date]}
         */
        jsonLogic.add_operation('isWeekday', (date: any) => {
            const day = new Date(date).getUTCDay();
            return day >= 1 && day <= 5;
        });

        /**
         * Check if date is a specific day of week
         * Usage: {"isDayOfWeek": [date, dayNumber]} where dayNumber is 0-6
         */
        jsonLogic.add_operation('isDayOfWeek', (date: any, dayNum: number) => {
            return new Date(date).getUTCDay() === dayNum;
        });

        /**
         * Check if date is Monday (helper)
         * Usage: {"isMonday": [date]}
         */
        jsonLogic.add_operation('isMonday', (date: any) => {
            return new Date(date).getUTCDay() === 1;
        });

        /**
         * Check if date is Friday (helper)
         * Usage: {"isFriday": [date]}
         */
        jsonLogic.add_operation('isFriday', (date: any) => {
            return new Date(date).getUTCDay() === 5;
        });

        // ============================================
        // HOLIDAY AND SPECIAL DAY OPERATIONS
        // ============================================

        /**
         * Check if date is a holiday from the holidays list
         * Usage: {"isHoliday": [date, holidaysArray]}
         */
        jsonLogic.add_operation('isHoliday', (date: any, holidays: any[]) => {
            const dateStr = new Date(date).toISOString().split('T')[0];
            return holidays.some((h: any) => {
                const holidayDate = typeof h === 'string' ? h : h.date;
                return holidayDate === dateStr;
            });
        });

        /**
         * Check if date is a business day (not weekend, not holiday)
         * Usage: {"isBusinessDay": [date, holidaysArray]}
         */
        jsonLogic.add_operation('isBusinessDay', (date: any, holidays: any[]) => {
            const d = new Date(date);
            const day = d.getUTCDay();

            // Check if weekend
            if (day === 0 || day === 6) return false;

            // Check if holiday
            const dateStr = d.toISOString().split('T')[0];
            return !holidays.some((h: any) => {
                const holidayDate = typeof h === 'string' ? h : h.date;
                return holidayDate === dateStr;
            });
        });

        // ============================================
        // DATE ARITHMETIC
        // ============================================

        /**
         * Add days to a date
         * Usage: {"addDays": [date, numberOfDays]}
         */
        jsonLogic.add_operation('addDays', (date: any, days: number) => {
            const d = new Date(date);
            d.setDate(d.getDate() + days);
            return d.toISOString().split('T')[0];
        });

        /**
         * Subtract days from a date
         * Usage: {"subtractDays": [date, numberOfDays]}
         */
        jsonLogic.add_operation('subtractDays', (date: any, days: number) => {
            const d = new Date(date);
            d.setDate(d.getDate() - days);
            return d.toISOString().split('T')[0];
        });

        // ============================================
        // CALENDAR OPERATIONS
        // ============================================

        /**
         * Get current date (today)
         * Usage: {"today": []}
         */
        jsonLogic.add_operation('today', () => {
            return new Date().toISOString().split('T')[0];
        });

        /**
         * Get the day of month (1-31)
         * Usage: {"dayOfMonth": [date]}
         */
        jsonLogic.add_operation('dayOfMonth', (date: any) => {
            return new Date(date).getUTCDate();
        });

        /**
         * Get the month (1-12)
         * Usage: {"monthOfYear": [date]}
         */
        jsonLogic.add_operation('monthOfYear', (date: any) => {
            return new Date(date).getUTCMonth() + 1;
        });

        /**
         * Get the year
         * Usage: {"year": [date]}
         */
        jsonLogic.add_operation('year', (date: any) => {
            return new Date(date).getUTCFullYear();
        });

        /**
         * Check if date is in a specific month
         * Usage: {"isInMonth": [date, monthNumber]} where monthNumber is 1-12
         */
        jsonLogic.add_operation('isInMonth', (date: any, month: number) => {
            return new Date(date).getUTCMonth() + 1 === month;
        });

        /**
         * Check if date is in a specific year
         * Usage: {"isInYear": [date, year]}
         */
        jsonLogic.add_operation('isInYear', (date: any, year: number) => {
            return new Date(date).getUTCFullYear() === year;
        });

        /**
         * Get start of month for a given date
         * Usage: {"startOfMonth": [date]}
         */
        jsonLogic.add_operation('startOfMonth', (date: any) => {
            const d = new Date(date);
            return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
                .toISOString().split('T')[0];
        });

        /**
         * Get end of month for a given date
         * Usage: {"endOfMonth": [date]}
         */
        jsonLogic.add_operation('endOfMonth', (date: any) => {
            const d = new Date(date);
            return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
                .toISOString().split('T')[0];
        });
    }


    static generate(template: DeadlineTemplate, triggerDate: string, fieldValues: Record<string, any> = {}): DeadlineEngineOutput {

        // step one: validate the trigger date
        let _triggerDate = new Date(triggerDate);

        const {
            valid: isTriggerDateValid,
            error: _triggerDateValidationError
        } = DeadlineEngine.validateDate(_triggerDate, template.data.triggerDateRules, template.data.holidays, template.data.deadDays);

        if (_triggerDateValidationError) {
            throw (_triggerDateValidationError);
        }

        const {
            valid: areFieldsValid,
            error: fieldValidationError
        } = DeadlineEngine.validateFields(template, fieldValues);

        if (fieldValidationError) {
            throw (fieldValidationError);
        }

        let output: DeadlineEngineOutput = {
            triggerDate: DeadlineEngine.formatToDateString(_triggerDate),
            deadlines: [],
            events: [],
            warnings: [],
            fieldValues: fieldValues,
            adjournments: [],
            generatedAt: DeadlineEngine.formatToDateString(new Date()),
            templateId: template.id,
            templateVersion: template.version,

            subProcesses: []
        };

        for (let deadline of template.data.deadlines) {
            switch (deadline.type) {
                case "offset":

                    const deadlineDate = DeadlineEngine.calculateOffsetDeadlineDate(deadline, template, output)

                    output.deadlines.push({
                        id: deadline.id,
                        name: deadline.name,
                        date: DeadlineEngine.formatToDateString(deadlineDate),
                        status: deadlineDate < _triggerDate ? "overdue" : "pending",
                        dependency: deadline.dependency
                    });
                    break;
                default:
                    throw new Error(`Unknown deadline type ${deadline.type}`);
            }
        }

        return output;
    }

    private static formatToDateString(d: Date): string {
        if(!d) {
            throw new Error("Invalid Date");
        }

        return d.toISOString().split('T')[0];
    }

    static resolveTargetDate(targetId: string, generatedTemplate: DeadlineEngineOutput): Date {
        if (targetId === this.TRIGGER_ID) {
            return new Date (generatedTemplate.triggerDate);
        }

        if (targetId.startsWith(this.DEADLINE_PREFIX)) { // deadline date
            let date = generatedTemplate.deadlines.find(deadline => deadline.id === targetId)?.date;

            if (!date) {
                throw new Error(`Could not find deadline with id ${targetId}`);
            }

            return new Date(date);
        }

        if (targetId.startsWith(this.FIELD_PREFIX)) {
            let fieldValue = DeadlineEngine.resolveTargetField(targetId, generatedTemplate);

            if (!fieldValue) {
                throw new Error(`Could not find field with id ${targetId}`);
            }

            return new Date(fieldValue);
        }

        throw new Error(`Could not resolve target date for id ${targetId}`);
    }

    static resolveTargetField(fieldId: string, generatedTemplate: DeadlineEngineOutput) {
        if (Object.keys(generatedTemplate.fieldValues).includes(fieldId)) {
            return generatedTemplate.fieldValues[fieldId];
        }

        throw new Error(`Could not find field with id ${fieldId}`);
    }

    static validateDate(date: Date, rules: { allowHolidays: boolean, allowWeekends: boolean }, holidays: {
        name: string,
        date: string
    }[] = [],deadDays: {
        name: string,
        date: string
    }[] = []): { valid: boolean, error: Error | null } {

        // check if the date falls on a dead day
        if(deadDays.find(d => d.date === this.formatToDateString(date))) {
            return {valid: false, error: new Error("Date falls on a dead day!")};
        }

        // check if the date is a weekend
        if (!rules.allowWeekends && (date.getUTCDay() === 0 || date.getUTCDay() === 6)) {
            return {valid: false, error: new Error("Weekends are not allowed")};
        }

        // check if the date is a holiday
        if (!rules.allowHolidays && !!holidays.find(holiday => holiday.date === date.toISOString().split("T")[0])) {
            return {valid: false, error: new Error("Holidays are not allowed")};
        }

        return {valid: true, error: null};
    }

    private static isHoliday(template: DeadlineTemplate, date: Date): boolean {
        const dateString = date.toISOString()?.split("T")[0];

        return !!(template.data.holidays.find(ds => ds.date === dateString));
    }

    static validateTargetId(targetId: string, template: DeadlineTemplate): boolean {
        if (targetId === DeadlineEngine.TRIGGER_ID) {
            return true;
        }

        if (targetId.startsWith(DeadlineEngine.DEADLINE_PREFIX)) {
            return template.data.deadlines.some(d => d.id === targetId);
        }

        return false;
    }

    static offsetDate(date: Date, offset: number, dateRules: OffsetDateRules = {
        allowWeekends: false,
        allowHolidays: false,
        adjustmentDirection: "forward"
    }, countingRules: OffsetCountingRules = {
        ignoreWeekends: false,
        ignoreHolidays: false,
        includeFirst: false
    }, holidays: { name: string, date: string }[] = [], deadDays: { name: string, date: string }[] = []): { date: Date, error: Error | null } {

        const addDays = (date: Date, days: number) => {
            const result = new Date(date);
            result.setDate(result.getDate() + days);
            return result;
        }

        const isWeekend = (date: Date) => date.getUTCDay() === 0 || date.getUTCDay() === 6;
        const isHoliday = (date: Date) => !!holidays.find(ds => ds.date === date.toISOString().split("T")[0]);

        // Handle zero offset
        if (offset === 0) {
            const {valid: isDateValid} = DeadlineEngine.validateDate(date, {
                allowHolidays: dateRules.allowHolidays,
                allowWeekends: dateRules.allowWeekends
            }, holidays, deadDays);

            if (!isDateValid) {
                if (dateRules.adjustmentDirection === "forward") {
                    let current = new Date(date);
                    while (true) {
                        current = addDays(current, 1);
                        const {valid} = DeadlineEngine.validateDate(current, {
                            allowHolidays: dateRules.allowHolidays,
                            allowWeekends: dateRules.allowWeekends
                        }, holidays, deadDays);
                        if (valid) {
                            return {date: current, error: null};
                        }
                    }
                } else {
                    let current = new Date(date);
                    while (true) {
                        current = addDays(current, -1);
                        const {valid} = DeadlineEngine.validateDate(current, {
                            allowHolidays: dateRules.allowHolidays,
                            allowWeekends: dateRules.allowWeekends
                        }, holidays, deadDays);
                        if (valid) {
                            return {date: current, error: null};
                        }
                    }
                }
            }
            return {date: date, error: null};
        }

        // Determine direction based on offset sign
        const direction = offset > 0 ? 1 : -1;
        const absOffset = Math.abs(offset);

        // Start from the trigger date
        let current = new Date(date);
        let daysAdded = 0;
        let lastValidDate: Date | null = null;

        // Handle includeFirst logic
        if (countingRules.includeFirst) {
            // Check if starting date should be counted
            const shouldCount = (!(countingRules.ignoreWeekends && isWeekend(current)) && !(countingRules.ignoreHolidays && isHoliday(current))) && !(deadDays.find(d => d.date === DeadlineEngine.formatToDateString(current)));

            if (shouldCount) {
                daysAdded++;

                // Track for backward adjustment
                if (dateRules.adjustmentDirection === "backward") {
                    const {valid} = DeadlineEngine.validateDate(current, {
                        allowHolidays: dateRules.allowHolidays,
                        allowWeekends: dateRules.allowWeekends
                    }, holidays, deadDays);
                    if (valid) {
                        lastValidDate = new Date(current);
                    }
                }
            }
        }

        // Count remaining days
        while (daysAdded < absOffset) {
            // Move to next/previous day
            current = addDays(current, direction);

            // Track valid dates for backward adjustment
            if (dateRules.adjustmentDirection === "backward") {
                const {valid} = DeadlineEngine.validateDate(current, {
                    allowHolidays: dateRules.allowHolidays,
                    allowWeekends: dateRules.allowWeekends
                }, holidays, deadDays);

                if (valid) {
                    lastValidDate = new Date(current);
                }
            }

            // Check if current date should be counted
            const shouldCount = !(countingRules.ignoreWeekends && isWeekend(current)) && !(countingRules.ignoreHolidays && isHoliday(current)) && !(deadDays.find(d => d.date === DeadlineEngine.formatToDateString(current)));

            if (shouldCount) {
                daysAdded++;
            }
        }

        // Now validate the final date and adjust if needed
        const {valid: isDateValid} = DeadlineEngine.validateDate(current, {
            allowHolidays: dateRules.allowHolidays,
            allowWeekends: dateRules.allowWeekends
        }, holidays, deadDays);

        if (!isDateValid) {
            if (dateRules.adjustmentDirection === "forward") {
                // Move forward until we find a valid date
                while (true) {
                    current = addDays(current, 1);

                    // Skip dates we should ignore during adjustment
                    if (countingRules.ignoreWeekends && isWeekend(current)) {
                        continue;
                    }

                    if (countingRules.ignoreHolidays && isHoliday(current)) {
                        continue;
                    }

                    const {valid: valid, error: error} = DeadlineEngine.validateDate(current, {
                        allowHolidays: dateRules.allowHolidays,
                        allowWeekends: dateRules.allowWeekends
                    }, holidays, deadDays);

                    if (valid) {
                        break;
                    }
                }
            } else if (dateRules.adjustmentDirection === "backward") {
                if (lastValidDate === null) {
                    return {date: current, error: new Error("No valid date found using backward adjustment")};
                }
                current = lastValidDate;
            }
        }

        return {date: current, error: null};
    }

    static findAllTemplateDependents(deadlineId: string, template: DeadlineTemplate): string[] {
        const dependents: string[] = [];

        for (const deadline of template.data.deadlines) {
            if (deadline.dependency.targetId === deadlineId) {
                dependents.push(deadline.id);
                // Recursively find their dependents too
                dependents.push(...DeadlineEngine.findAllTemplateDependents(deadline.id, template));
            }
        }

        return dependents;
    }

    static sortByDependency(deadlineIds: string[], template: DeadlineTemplate): void {
    }

    static validateParties(template: DeadlineTemplate, parties: Record<string, any>, representing: {
        role_id?: string,
        party_member_ids?: string[]
    }): boolean {
        if (!template.data.parties.enabled) return false;

        // validate the min and max requirements of each role
        for (const role of template.data.parties.roles) {
            const roleMembers = parties[role.id] || [];

            // validate min
            if (roleMembers.length < role.memberCount.minimum) {
                throw new Error(`${role.name} requires atleast ${role.memberCount.minimum} members`);
            }

            // validate max
            if (role.memberCount.maximum) {
                if (roleMembers.length > role.memberCount.maximum) {
                    throw new Error(`${role.name} requires at most ${role.memberCount.maximum} members`);
                }
            }
        }

        // validate the representation requirement
        if ((template.data.parties.representationRequired)) {
            if (!representing || !representing?.role_id || !representing?.party_member_ids || representing?.party_member_ids?.length === 0) {
                throw new Error('You must specify which parties you are representing');
            }
        }

        return true;
    }

    static validateFields(template: DeadlineTemplate, fieldValues: Record<string, any> = {}): {
        valid: boolean,
        error: Error | null
    } {
        if (template.data.fields.length === 0) return {valid: true, error: null};

        const missingFields = template.data.fields
            .filter(field => field.required === true)
            .filter(field => fieldValues[field.id] === undefined || fieldValues[field.id] === null)
            .map(field => field.name);

        if (missingFields.length > 0) {
            return {valid: false, error: new Error(`Missing required fields: ${missingFields.join(', ')}`)};
        }

        return {valid: true, error: null};
    }

    static buildLogicContext(template: DeadlineTemplate, output: DeadlineEngineOutput, currentDeadline: any): Record<string, any> {
        const now = new Date();

        return {
            "fields": output.fieldValues,

            "deadlines": output.deadlines.reduce((acc, d) => {
                acc[d.id] = {
                    date: d.date,
                    status: d.status == "pending" ? ((new Date(d.date) < now) ? "overdue" : "pending" ) : d.status,
                };

                return acc;
            }, {} as Record<string, any>),

            "trigger": {
                date: new Date(output.triggerDate),
                dayOfWeek: (new Date(output.triggerDate)).getUTCDay(),
                isWeekend: [0, 6].includes((new Date(output.triggerDate)).getUTCDay()),
            },

            "today": {
                date: DeadlineEngine.formatToDateString(now),
            },

            "current": {
                deadlineId: currentDeadline.id,
            }
        }
    }

    static applyAction(template: DeadlineTemplate, output: DeadlineEngineOutput, action: DeadlineEngineFulfillAction | DeadlineEngineRecalculateAction | DeadlineEngineAdjournAction | DeadlineEngineSpawnAction): DeadlineEngineOutput {
        switch (action.action) {
            case "FULFILL":
                return DeadlineEngine.handleFulfill(template, output, action);
            case "RECALCULATE":
                return DeadlineEngine.handleRecalculate(template, output, action);
            case "ADJOURN":
                return DeadlineEngine.handleAdjourn(template, output, action);
            case "SPAWN":
                return DeadlineEngine.handleSpawn(template, output, action);
            default:
                throw new Error(`Unknown action: ${action.action}.`);
        }
    }

    private static findDeadlineInOutput(output: DeadlineEngineOutput, deadlineId: string) {
        return output.deadlines.find(d => d.id === deadlineId);
    }

    private static handleFulfill(template: DeadlineTemplate, output: DeadlineEngineOutput, action: DeadlineEngineFulfillAction) {
        let mutable = _.cloneDeep(output);
        const deadline = DeadlineEngine.findDeadlineInOutput(mutable, action.meta.targetId);

        if (!deadline) {
            throw new Error(`Deadline ${action.meta.targetId} not found`);
        }

        deadline.status = "fulfilled";
        deadline.date = DeadlineEngine.formatToDateString(new Date(action.meta.fulfilledDate));

        const dependents = DeadlineEngine.findAllTemplateDependents(deadline.id, template);

        for (const dependent of dependents) {
            const dynamic = template.data.deadlines.find(d => d.id === dependent)?.dynamic || false;

            if (!dynamic) {
                continue;
            }

            mutable = DeadlineEngine.applyAction(template, mutable, {
                action: "RECALCULATE",
                meta: {targetId: dependent}
            });
        }

        return mutable;
    }

    private static handleRecalculate(template: DeadlineTemplate, output: DeadlineEngineOutput, action: DeadlineEngineRecalculateAction) {
        let mutable = _.cloneDeep(output);
        const deadline = DeadlineEngine.findDeadlineInOutput(mutable, action.meta.targetId);

        if (!deadline) {
            throw new Error(`Deadline ${action.meta.targetId} not found`);
        }

        const templateDeadline = template.data.deadlines.find(d => d.id === deadline.id);

        if (!templateDeadline) {
            throw new Error(`Deadline ${action.meta.targetId} not found in template`);
        }
        const newDate = DeadlineEngine.calculateOffsetDeadlineDate(templateDeadline, template, output);

        deadline.date = newDate;
        return mutable;
    }

    private static handleAdjourn(template: DeadlineTemplate, output: DeadlineEngineOutput, action: DeadlineEngineAdjournAction) {
        let mutable : DeadlineEngineOutput = _.cloneDeep(output);
        const deadline = DeadlineEngine.findDeadlineInOutput(mutable, action.meta.targetId);
        const templateDeadline = template.data.deadlines.find(d => d.id === deadline.id);

        if (!deadline) {
            throw new Error(`Deadline ${action.meta.targetId} not found`);
        }

        if(!templateDeadline) {
            throw new Error(`Deadline ${action.meta.targetId} not found in template`);
        }

        const { valid: isDateValid, error: error } = DeadlineEngine.validateDate(new Date(action.meta.adjournedDate), templateDeadline.offset.dateRules);

        if(!isDateValid && !action.meta.force) {
            throw error;
        }

        const oldDate = deadline.date;

        deadline.date = action.meta.adjournedDate;

        const dependents = DeadlineEngine.findAllTemplateDependents(deadline.id, template);

        for (const dependent of dependents) {
            const dynamic = template.data.deadlines.find(d => d.id === dependent)?.dynamic || false;

            if (!dynamic) {
                continue;
            }

            mutable = DeadlineEngine.applyAction(template, mutable, {
                action: "RECALCULATE",
                meta: {targetId: dependent}
            });
        }

        mutable.adjournments.push({
            id: "_new_",
            targetId: action.meta.targetId,
            from: oldDate,
            to: deadline.date,
            reason: action.meta.reason
        });

        return mutable;
    }

    private static handleSpawn(template: DeadlineTemplate, output: DeadlineEngineOutput, action: DeadlineEngineSpawnAction) {
        let mutable : DeadlineEngineOutput = _.cloneDeep(output);
        const deadline = DeadlineEngine.findDeadlineInOutput(mutable, action.meta.targetId);
        const templateDeadline = template.data.deadlines.find(d => d.id === deadline.id);

        const templateData = action.meta.template;

        if (!deadline) {
            throw new Error(`Deadline ${action.meta.targetId} not found`);
        }

        if (!templateDeadline) {
            throw new Error(`Deadline ${action.meta.targetId} not found in template`);
        }

        if(!(templateDeadline.applications && templateDeadline.applications.enabled)) {
            throw new Error(`Deadline ${action.meta.targetId} does not support applications and subprocesses!`);
        }

        const buildContext = DeadlineEngine.buildLogicContext(template, output, deadline);
        const logicResult = jsonLogic.apply(templateDeadline.applications.conditions.rules, buildContext);

        if (!(logicResult)) {
            throw new Error(`Deadline ${action.meta.targetId} conditions are not satisfied for application or subprocesses!`);
        }

        // create the spawn output for us
        const spawnOutput = DeadlineEngine.generate(templateData, deadline.date, action.meta.fieldValues);

        const subProcess = {
            id: "_new_",
            name: templateData.name,
            template: templateData,
            output: spawnOutput
        };

        mutable.subProcesses.push(subProcess);

        return mutable;
    }

    static checkApplicationCondition(template: DeadlineTemplate, output: DeadlineEngineOutput, deadlineId : string) {
        const deadline = DeadlineEngine.findDeadlineInOutput(output, deadlineId);
        const templateDeadline = template.data.deadlines.find(d => d.id === deadline.id);

        if (!deadline) {
            throw new Error(`Deadline ${deadlineId} not found`);
        }

        if (!templateDeadline) {
            throw new Error(`Deadline ${deadlineId} not found in template`);
        }

        if(!(templateDeadline.applications && templateDeadline.applications.enabled)) {
            throw new Error(`Deadline ${deadlineId} does not support applications and subprocesses!`);
        }

        const buildContext = DeadlineEngine.buildLogicContext(template, output, deadline);
        const logicResult = jsonLogic.apply(templateDeadline.applications.conditions.rules, buildContext);

        return logicResult;
    }

    private static calculateOffsetDeadlineDate(deadline: DeadlineTemplateDeadLine, template: DeadlineTemplate, output: DeadlineEngineOutput) {
        let targetDependency = deadline.dependency.targetId;

        if (deadline.dependency.conditions && deadline.dependency.conditions.enabled) {
            const targetContext = DeadlineEngine.buildLogicContext(template, output, deadline);


            for (const condition of deadline.dependency.conditions.conditions) {
                if (condition.enabled && condition.rules) {
                    if (jsonLogic.apply(condition.rules, targetContext)) {
                        targetDependency = condition.targetId;
                        break;
                    }
                }
            }
        }
        let baseDate = DeadlineEngine.resolveTargetDate(targetDependency, output);

        let offset = deadline.offset.days;

        if (deadline.offset.conditions && deadline.offset.conditions.enabled) {
            const context = DeadlineEngine.buildLogicContext(template, output, deadline);

            for (const condition of deadline.offset.conditions.conditions) {
                if (condition.enabled && condition.rules) {
                    if (jsonLogic.apply(condition.rules, context)) {

                        offset = condition.offset; // set the condition offset to our offset
                        break;
                    }
                }
            }
        }

        let {
            date: deadlineDate,
            error: deadlineDateValidationError
        } = DeadlineEngine.offsetDate(baseDate, offset, deadline.offset.dateRules, deadline.offset.countingRules, template?.data.holidays, template?.data?.deadDays);

        if (deadlineDateValidationError) {
            throw (deadlineDateValidationError);
        }

        return deadlineDate;
    }

    private static findAllEngineDependents(output: DeadlineEngineOutput, deadlineId: string) {
        return output.deadlines.filter(d => d.dependency.targetId === deadlineId);
    }

}

