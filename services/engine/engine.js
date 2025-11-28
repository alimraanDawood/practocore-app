/**
 * @typedef {object} TemplateDateRules
 * @property {boolean} allowWeekends
 * @property {boolean} allowHolidays
 */

/**
 * @typedef {object} TemplateField
 * @property {string} id
 * @property {string} name
 * @property {string} label
 * @property {"text" | "select" | "number" | "date" | "boolean"} type
 * @property {boolean} required
 * @property {Array<{value: string, label: string}>} [options] - For select type
 * @property {any} [defaultValue]
 */

/**
 * @typedef {object} Condition
 * @property {"field" | "deadline_completed" | "deadline_status" | "date_range" | "party_count" | "party_type"} type
 * @property {string} [fieldId] - For field conditions
 * @property {string} [deadlineId] - For deadline conditions
 * @property {string} [roleId] - For party conditions
 * @property {"equals" | "not_equals" | "in" | "not_in" | "greater_than" | "less_than" | "any_equals" | "all_equals" | "days_until" | "days_since" | "within_days" | "beyond_days" | "day_of_week" | "is_weekend" | "is_weekday"} [operator]
 * @property {any} [value]
 */

/**
 * @typedef {object} TemplateOffset
 * @property {string} offsetId - Can be '_date_', a deadline ID ('d_xxx'), or a date field ID ('f_xxx')
 * @property {number} days
 * @property {boolean} ignoreWeekends
 * @property {boolean} ignoreHolidays
 * @property {boolean} allowWeekends
 * @property {boolean} allowHolidays
 * @property {false} includeFirst
 * @property {object} [conditional] - Conditional offset rules
 * @property {Array<{conditions: Condition[], days: number, offsetId?: string}>} [conditional.rules]
 * @property {number} [conditional.default] - Default days if no condition matches
 */

/**
 * @typedef {object} TemplateDeadline
 * @property {string} id
 * @property {string} name
 * @property {string} [description]
 * @property {string} actionLabel
 * @property {"offset" | "other"} type
 * @property {boolean} dynamic
 * @property {TemplateOffset} offset
 * @property {Condition[]} [conditions] - Conditions that must be met for this deadline to be active
 * @property {string[]} [dependencies] - IDs of deadlines that must be completed first
 */

/**
 * @typedef {object} Template
 * @property {string} id
 * @property {string} name
 * @property {string} [version]
 * @property {TemplateDateRules} date_rules
 * @property {TemplateField[]} [fields]
 * @property {TemplateDeadline[]} deadlines
 */

/**
 * @typedef {object} CalculatedDeadline
 * @property {string} id
 * @property {Date} date
 * @property {boolean} active - Whether this deadline is active based on conditions
 * @property {string} [skippedReason] - Why this deadline was skipped
 */

export class DeadlineEngine {
    constructor() { }

    /**
     * Helper function to add days to a Date object.
     * @param {Date} date
     * @param {number} days
     * @returns {Date}
     */
    addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    /**
     * Helper function to calculate the number of days between two dates.
     * @param {Date} startDate
     * @param {Date} endDate
     * @returns {number} - Number of days (can be negative if endDate is before startDate)
     */
    getDaysBetween(startDate, endDate) {
        // Reset time to midnight for both dates to get accurate day count
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);

        const end = new Date(endDate);
        end.setHours(0, 0, 0, 0);

        const diffTime = end.getTime() - start.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        return diffDays;
    }

    /**
     * Evaluates a single condition against provided field values and deadline statuses
     * @param {Condition} condition
     * @param {object} fieldValues - Key-value pairs of field values
     * @param {object} deadlineStatuses - Key-value pairs of deadline completion status
     * @param {object} parties - Party data organized by role
     * @param {object} partyMember - Current party member context (for per-party conditions)
     * @returns {boolean}
     */
    evaluateCondition(condition, fieldValues = {}, deadlineStatuses = {}, parties = {}, partyMember = null) {
        switch (condition.type) {
            case "field":
                const fieldValue = fieldValues[condition.fieldId];
                switch (condition.operator) {
                    case "equals":
                        return fieldValue === condition.value;
                    case "not_equals":
                        return fieldValue !== condition.value;
                    case "in":
                        return Array.isArray(condition.value) && condition.value.includes(fieldValue);
                    case "not_in":
                        return Array.isArray(condition.value) && !condition.value.includes(fieldValue);
                    case "greater_than":
                        return fieldValue > condition.value;
                    case "less_than":
                        return fieldValue < condition.value;

                    // Date-specific operators
                    case "days_until":
                        // Check if date is exactly X days away
                        return this.getDaysBetween(new Date(), new Date(fieldValue)) === condition.value;
                    case "days_since":
                        // Check if date was exactly X days ago
                        return this.getDaysBetween(new Date(fieldValue), new Date()) === condition.value;
                    case "within_days":
                        // Check if date is within X days from now (future)
                        const daysUntil = this.getDaysBetween(new Date(), new Date(fieldValue));
                        return daysUntil >= 0 && daysUntil <= condition.value;
                    case "beyond_days":
                        // Check if date is more than X days away from now (future)
                        return this.getDaysBetween(new Date(), new Date(fieldValue)) > condition.value;
                    case "day_of_week":
                        // Check if date falls on a specific day of week
                        // value should be 0-6 (0=Sunday, 1=Monday, ..., 6=Saturday)
                        return new Date(fieldValue).getDay() === condition.value;
                    case "is_weekend":
                        // Check if date falls on a weekend
                        const dayOfWeek = new Date(fieldValue).getDay();
                        return dayOfWeek === 0 || dayOfWeek === 6;
                    case "is_weekday":
                        // Check if date falls on a weekday
                        const weekday = new Date(fieldValue).getDay();
                        return weekday >= 1 && weekday <= 5;

                    default:
                        return false;
                }

            case "deadline_completed":
                return deadlineStatuses[condition.deadlineId] === true;

            case "deadline_status":
                return deadlineStatuses[condition.deadlineId] === condition.value;

            case "party_count":
                const roleMembers = parties[condition.roleId] || [];
                const count = roleMembers.length;
                switch (condition.operator) {
                    case "equals":
                        return count === condition.value;
                    case "greater_than":
                        return count > condition.value;
                    case "less_than":
                        return count < condition.value;
                    default:
                        return false;
                }

            case "party_type":
                // Check if ANY or ALL parties in the specified role match the type
                const partyMembers = parties[condition.roleId] || [];
                if (condition.operator === 'any_equals') {
                    return partyMembers.some(member => member.type === condition.value);
                }
                if (condition.operator === 'all_equals') {
                    return partyMembers.every(member => member.type === condition.value);
                }
                // If we have a current party member context, check just that member
                if (partyMember && condition.operator === 'equals') {
                    return partyMember.type === condition.value;
                }
                return false;

            default:
                return true;
        }
    }

    /**
     * Evaluates an array of conditions (AND logic)
     * @param {Condition[]} conditions
     * @param {object} fieldValues
     * @param {object} deadlineStatuses
     * @param {object} parties
     * @param {object} partyMember
     * @returns {boolean}
     */
    evaluateConditions(conditions, fieldValues = {}, deadlineStatuses = {}, parties = {}, partyMember = null) {
        if (!conditions || conditions.length === 0) return true;
        return conditions.every(condition =>
            this.evaluateCondition(condition, fieldValues, deadlineStatuses, parties, partyMember)
        );
    }

    /**
     * Determines the number of days for an offset based on conditional rules
     * @param {TemplateOffset} offset
     * @param {object} fieldValues
     * @param {object} deadlineStatuses
     * @param {object} parties
     * @param {object} partyMember
     * @returns {number}
     */
    getConditionalDays(offset, fieldValues = {}, deadlineStatuses = {}, parties = {}, partyMember = null) {
        // If no conditional rules, return the default days
        if (!offset.conditional || !offset.conditional.rules) {
            return offset.days;
        }

        // Check each conditional rule
        for (const rule of offset.conditional.rules) {
            if (this.evaluateConditions(rule.conditions, fieldValues, deadlineStatuses, parties, partyMember)) {
                return rule.days;
            }
        }

        // Return conditional default or regular default
        return offset.conditional.default !== undefined ? offset.conditional.default : offset.days;
    }

    /**
     * Determines the offset configuration (days and offsetId) based on conditional rules
     * @param {TemplateOffset} offset
     * @param {object} fieldValues
     * @param {object} deadlineStatuses
     * @param {object} parties
     * @param {object} partyMember
     * @returns {{days: number, offsetId: string}}
     */
    getConditionalOffsetConfig(offset, fieldValues = {}, deadlineStatuses = {}, parties = {}, partyMember = null) {
        // Default configuration
        let config = {
            days: offset.days,
            offsetId: offset.offsetId
        };

        // If no conditional rules, return defaults
        if (!offset.conditional || !offset.conditional.rules) {
            return config;
        }

        // Check each conditional rule
        for (const rule of offset.conditional.rules) {
            if (this.evaluateConditions(rule.conditions, fieldValues, deadlineStatuses, parties, partyMember)) {
                config.days = rule.days;
                // If rule specifies an offsetId override, use it
                if (rule.offsetId) {
                    config.offsetId = rule.offsetId;
                }
                return config;
            }
        }

        // Return conditional default or regular default
        if (offset.conditional.default !== undefined) {
            config.days = offset.conditional.default;
        }

        return config;
    }

    /**
     * Resolves the base date from an offsetId reference
     * @param {string} offsetId - Can be '_date_', deadline ID, or field ID
     * @param {Date} startDate - Template start date
     * @param {object} fieldValues - Field values
     * @param {Array} deadlines - Already calculated deadlines
     * @param {object} partyMember - Current party context (for party-specific deadlines)
     * @returns {Date}
     */
    resolveBaseDate(offsetId, startDate, fieldValues, deadlines, partyMember = null) {
        // Special case: template start date
        if (offsetId === '_date_') {
            return startDate;
        }

        // Check if it's a date field reference (starts with 'f_')
        if (offsetId.startsWith('f_')) {
            const fieldValue = fieldValues[offsetId];
            if (fieldValue) {
                // Parse the field value as a date
                const parsedDate = new Date(fieldValue);
                if (!isNaN(parsedDate.getTime())) {
                    return parsedDate;
                }
            }
            // Fall back to start date if field not found or invalid
            console.warn(`[DeadlineEngine] Date field "${offsetId}" not found or invalid, using start date as fallback`);
            return startDate;
        }

        // It's a deadline reference - find matching deadline
        // Try to find party-specific deadline first if in party context
        if (partyMember) {
            const partyDeadline = deadlines.find(d =>
                (d.templateId === offsetId || d.id === offsetId) &&
                d.partyContext?.party_member_id === partyMember.id
            );
            if (partyDeadline) {
                return partyDeadline.date;
            }
        }

        // Fall back to non-party-specific deadline
        const deadline = deadlines.find(d => d.id === offsetId);
        if (deadline) {
            return deadline.date;
        }

        // Last resort: use start date
        console.warn(`[DeadlineEngine] Deadline "${offsetId}" not found, using start date as fallback`);
        return startDate;
    }

    /**
     * Calculates the deadline date based on a template deadline and a start date.
     * @param {TemplateDeadline} t_deadline
     * @param {Date} startDate
     * @param {object} fieldValues
     * @param {object} deadlineStatuses
     * @param {object} parties
     * @param {object} partyMember
     * @param {Array} deadlines - Already calculated deadlines (for base date resolution)
     * @returns {Date}
     */
    createDeadlineFromTemplateDeadline(t_deadline, startDate, fieldValues = {}, deadlineStatuses = {}, parties = {}, partyMember = null, deadlines = []) {
        // Get conditional offset configuration (days and potentially different offsetId)
        const offsetConfig = this.getConditionalOffsetConfig(
            t_deadline.offset,
            fieldValues,
            deadlineStatuses,
            parties,
            partyMember
        );

        // Resolve the base date using the (potentially conditional) offsetId
        const baseDate = this.resolveBaseDate(
            offsetConfig.offsetId,
            startDate,
            fieldValues,
            deadlines,
            partyMember
        );

        let deadlineDate = new Date(baseDate);
        let offset = offsetConfig.days;

        // Handle negative offsets (e.g., "day before")
        const isNegativeOffset = offset < 0;
        const absOffset = Math.abs(offset);

        // Handle includeFirst (only applies to positive offsets)
        if (!isNegativeOffset && !t_deadline.offset.includeFirst && absOffset > 0) {
            deadlineDate = this.addDays(deadlineDate, 1);
        }

        // Count the offset days
        let daysToCount = absOffset;
        const direction = isNegativeOffset ? -1 : 1;

        // Special handling for includeFirst with negative offsets
        if (isNegativeOffset && !t_deadline.offset.includeFirst) {
            daysToCount = absOffset > 0 ? absOffset - 1 : 0;
        }

        while (daysToCount > 0) {
            deadlineDate = this.addDays(deadlineDate, direction);

            // Skip weekends if ignoreWeekends is true (0=Sunday, 6=Saturday)
            if (t_deadline.offset.ignoreWeekends && [0, 6].includes(deadlineDate.getDay())) {
                continue; // Don't decrement counter for weekend days
            }

            // Skip holidays if ignoreHolidays is true
            if (t_deadline.offset.ignoreHolidays) {
                // TODO: check for a holiday and continue if true
                // TODO: Each template should define a list of holidays that it shall skip
            }

            daysToCount -= 1;
        }

        // Adjust if deadline falls on disallowed day
        // For negative offsets, move backward; for positive, move forward
        while (
            ([0, 6].includes(deadlineDate.getDay()) && !t_deadline.offset.allowWeekends) ||
            (false) // TODO: holiday check here
            ) {
            deadlineDate = this.addDays(deadlineDate, direction);
        }

        return deadlineDate;
    }

    /**
     * Creates reminders for a deadline
     * @param {TemplateDeadline} t_deadline
     * @param {Date} deadlineDate
     * @returns {Array<{id: string, date: Date}>}
     */
    createDeadlineRemindersFromTemplateDeadline(t_deadline, deadlineDate) {
        let reminders = [];

        if (t_deadline.reminders) {
            for (let reminder of t_deadline.reminders) {
                reminders.push({
                    id: reminder.id,
                    date: this.addDays(deadlineDate, reminder.offset)
                });
            }
        }

        return reminders;
    }

    /**
     * Validates party configuration against template requirements
     * @param {object} partyConfig - Template party configuration
     * @param {object} parties - Actual party data organized by role
     * @param {object} representing - Representation data
     * @throws {Error} If party requirements are not met
     */
    validateParties(partyConfig, parties, representing) {
        if (!partyConfig || !partyConfig.enabled) return;

        // Validate each role meets min/max requirements
        for (const role of partyConfig.roles) {
            const roleMembers = parties[role.id] || [];

            if (roleMembers.length < role.min_count) {
                throw new Error(
                    `${role.name} requires at least ${role.min_count} party member(s), but only ${roleMembers.length} provided`
                );
            }

            if (role.max_count && roleMembers.length > role.max_count) {
                throw new Error(
                    `${role.name} cannot have more than ${role.max_count} party member(s), but ${roleMembers.length} provided`
                );
            }
        }

        // Validate representation requirement
        if (partyConfig.representation_required) {
            if (!representing || !representing.role_id || !representing.party_member_ids || representing.party_member_ids.length === 0) {
                throw new Error('You must specify which parties you are representing');
            }
        }
    }

    /**
     * Filters parties based on deadline party configuration
     * @param {object} parties - All parties organized by role
     * @param {object} multiplicityConfig - Deadline's multiplicity configuration
     * @param {object} representing - Representation data
     * @returns {Array} Filtered party members
     */
    filterPartiesByConfig(parties, multiplicityConfig, representing) {
        if (!multiplicityConfig || !multiplicityConfig.type || multiplicityConfig.type === 'single') {
            return [];
        }

        let allParties = [];

        // Collect parties based on role_id or side
        if (multiplicityConfig.role_id) {
            allParties = parties[multiplicityConfig.role_id] || [];
        } else if (multiplicityConfig.side) {
            // Collect all parties from roles matching the specified side
            // This requires knowing which roles are on which side (from template party_config)
            // For now, collect all parties if side is 'all'
            if (multiplicityConfig.side === 'all') {
                allParties = Object.values(parties).flat();
            } else {
                // TODO: Filter by side when we have access to party_config
                allParties = Object.values(parties).flat();
            }
        } else {
            // No filter specified, use all parties
            allParties = Object.values(parties).flat();
        }

        // Filter by representation if needed
        if (multiplicityConfig.apply_to_representing && representing) {
            allParties = allParties.filter(party =>
                representing.party_member_ids.includes(party.id)
            );
        }

        return allParties;
    }

    /**
     * Generates deadline name using party information and template
     * @param {string} nameTemplate - Template pattern like "Serve {{party.name}}"
     * @param {object} partyMember - Party member data
     * @param {string} fallbackName - Original deadline name if no template
     * @returns {string} Generated name
     */
    interpolatePartyTemplate(nameTemplate, partyMember, fallbackName) {
        if (!nameTemplate || !partyMember) {
            return fallbackName;
        }

        return nameTemplate
            .replace(/\{\{party\.name\}\}/g, partyMember.name || '')
            .replace(/\{\{party\.type\}\}/g, partyMember.type || '')
            .replace(/\{\{party\.role\}\}/g, partyMember.role_id || '')
            .replace(/\{\{party\.email\}\}/g, partyMember.contact_info?.email || 'N/A')
            .replace(/\{\{party\.phone\}\}/g, partyMember.contact_info?.phone || 'N/A');
    }

    /**
     * Validates required fields are provided
     * @param {Template} template
     * @param {object} fieldValues
     * @throws {Error} If required fields are missing
     */
    validateFields(template, fieldValues) {
        if (!template.fields) return;

        const missingFields = template.fields
            .filter(field => field.required)
            .filter(field => fieldValues[field.id] === undefined || fieldValues[field.id] === null)
            .map(field => field.label || field.name);

        if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }
    }

    /**
     * Generates all deadlines for a given template and start date.
     * @param {Template} template
     * @param {Date} startDate
     * @param {object} fieldValues - Values for template fields
     * @param {object} existingDeadlineStatuses - Status of existing deadlines (for updates)
     * @param {object} parties - Party data organized by role (optional for backwards compatibility)
     * @param {object} representing - Representation data (optional)
     * @returns {CalculatedDeadline[]}
     */
    createDeadlinesFromTemplate(template, startDate, fieldValues = {}, existingDeadlineStatuses = {}, parties = {}, representing = null) {
        // Validate fields
        this.validateFields(template, fieldValues);

        // Validate parties if template has party configuration
        if (template.party_config && template.party_config.enabled) {
            this.validateParties(template.party_config, parties, representing);
        }

        // Validate start date based on template rules
        if (template?.date_rules?.allowHolidays) { /* TODO: implement */ }

        if (!template?.date_rules?.allowWeekends) {
            if (([0, 6]).includes(startDate.getDay())) {
                throw new Error("Invalid! Date cannot be a weekend!");
            }
        }

        /** @type {CalculatedDeadline[]} */
        let deadlines = [];
        let deadlineStatuses = { ...existingDeadlineStatuses };

        for (const t_deadline of template.deadlines) {
            // Check if this deadline has party multiplicity
            const hasMultiplicity = t_deadline.multiplicity &&
                t_deadline.multiplicity.type &&
                t_deadline.multiplicity.type !== 'single';

            if (hasMultiplicity) {
                // Generate per-party deadlines
                const applicableParties = this.filterPartiesByConfig(parties, t_deadline.multiplicity, representing);

                if (applicableParties.length === 0) {
                    // No applicable parties, skip this deadline
                    deadlines.push({
                        id: t_deadline.id,
                        date: null,
                        active: false,
                        skippedReason: "No applicable parties"
                    });
                    continue;
                }

                // Generate one deadline for each applicable party
                for (const partyMember of applicableParties) {
                    // Check if this deadline should be active based on conditions (including party-specific)
                    const isActive = this.evaluateConditions(
                        t_deadline.conditions,
                        fieldValues,
                        deadlineStatuses,
                        parties,
                        partyMember
                    );

                    if (!isActive) {
                        deadlines.push({
                            id: `${t_deadline.id}_${partyMember.id}`,
                            templateId: t_deadline.id,
                            date: null,
                            active: false,
                            skippedReason: "Conditions not met",
                            partyContext: { party_member_id: partyMember.id, party_name: partyMember.name }
                        });
                        continue;
                    }

                    const deadline = this.createDeadlineFromTemplateDeadline(
                        t_deadline,
                        startDate,
                        fieldValues,
                        deadlineStatuses,
                        parties,
                        partyMember,
                        deadlines  // Pass deadlines array for base date resolution
                    );

                    // Generate dynamic name using template interpolation
                    const deadlineName = this.interpolatePartyTemplate(
                        t_deadline.name_template,
                        partyMember,
                        t_deadline.name
                    );

                    const deadlineDescription = this.interpolatePartyTemplate(
                        t_deadline.description_template,
                        partyMember,
                        t_deadline.description
                    );

                    deadlines.push({
                        id: `${t_deadline.id}_${partyMember.id}`,
                        templateId: t_deadline.id,
                        date: deadline,
                        active: true,
                        name: deadlineName,
                        description: deadlineDescription,
                        partyContext: {
                            party_member_id: partyMember.id,
                            party_name: partyMember.name,
                            party_role: partyMember.role_id,
                            party_type: partyMember.type
                        }
                    });
                }

                // Mark template deadline as processed (all parties handled)
                // Use true to indicate the template has been processed, so dependent deadlines can proceed
                deadlineStatuses[t_deadline.id] = true;

            } else {
                // Regular non-party deadline (backwards compatible)
                const isActive = this.evaluateConditions(
                    t_deadline.conditions,
                    fieldValues,
                    deadlineStatuses,
                    parties,
                    null
                );

                if (!isActive) {
                    deadlines.push({
                        id: t_deadline.id,
                        date: null,
                        active: false,
                        skippedReason: "Conditions not met"
                    });
                    deadlineStatuses[t_deadline.id] = false;
                    continue;
                }

                // Check dependencies
                if (t_deadline.dependencies && t_deadline.dependencies.length > 0) {
                    const unmetDependencies = t_deadline.dependencies.filter(
                        depId => !deadlineStatuses[depId]
                    );

                    if (unmetDependencies.length > 0) {
                        deadlines.push({
                            id: t_deadline.id,
                            date: null,
                            active: false,
                            skippedReason: `Waiting for dependencies: ${unmetDependencies.join(', ')}`
                        });
                        continue;
                    }
                }

                const deadline = this.createDeadlineFromTemplateDeadline(
                    t_deadline,
                    startDate,
                    fieldValues,
                    deadlineStatuses,
                    parties,
                    null,
                    deadlines  // Pass deadlines array for base date resolution
                );

                deadlines.push({
                    id: t_deadline.id,
                    date: deadline,
                    active: true
                });
                // Mark as processed so dependent deadlines can proceed
                deadlineStatuses[t_deadline.id] = true;
            }
        }

        return deadlines;
    }

    /**
     * Performs initial start date validation.
     * @param {Template} template
     * @param {Date} date
     */
    getStartDateFromTemplate(template, date) {
        if (template.date_rules.allowHolidays) { /* TODO: implement */ }

        if (!template.date_rules.allowWeekends) {
            if (([0, 6]).includes(date.getDay())) {
                throw new Error("Invalid! Date cannot be a weekend!");
            }
        }
    }

    /**
     * Get nth occurrence of weekday in month (for DST calculations)
     * @param {number} year
     * @param {number} month - 0-11
     * @param {number} weekday - 0=Sunday, 6=Saturday
     * @param {number} n - 1st, 2nd, 3rd, etc.
     * @returns {Date}
     */
    getNthWeekdayOfMonth(year, month, weekday, n) {
        const firstDay = new Date(year, month, 1);
        const firstWeekday = firstDay.getDay();

        // Calculate days until first occurrence of target weekday
        let daysUntilFirst = (weekday - firstWeekday + 7) % 7;

        // Add weeks to get nth occurrence
        const targetDate = 1 + daysUntilFirst + (n - 1) * 7;
        return new Date(year, month, targetDate, 2, 0, 0); // 2 AM transition
    }

    /**
     * Get last occurrence of weekday in month (for DST calculations)
     * @param {number} year
     * @param {number} month - 0-11
     * @param {number} weekday - 0=Sunday, 6=Saturday
     * @returns {Date}
     */
    getLastWeekdayOfMonth(year, month, weekday) {
        // Start from last day of month
        const lastDay = new Date(year, month + 1, 0);
        const lastDate = lastDay.getDate();
        const lastWeekday = lastDay.getDay();

        // Calculate days back to last occurrence of target weekday
        let daysBack = (lastWeekday - weekday + 7) % 7;
        const targetDate = lastDate - daysBack;

        return new Date(year, month, targetDate, 2, 0, 0); // 2 AM transition
    }

    /**
     * Get DST rules for a timezone and year
     * @param {string} timezone
     * @param {number} year
     * @returns {object|null} - {start: Date, end: Date} or null if no DST
     */
    getDSTRules(timezone, year) {
        // US/Canada: 2nd Sunday in March to 1st Sunday in November
        if (timezone.startsWith('America/')) {
            // Arizona doesn't observe DST
            if (timezone === 'America/Phoenix') return null;

            return {
                start: this.getNthWeekdayOfMonth(year, 2, 0, 2), // 2nd Sunday of March
                end: this.getNthWeekdayOfMonth(year, 10, 0, 1)  // 1st Sunday of November
            };
        }

        // EU: Last Sunday in March to last Sunday in October
        if (timezone.startsWith('Europe/')) {
            // Russia doesn't observe DST (since 2014)
            if (timezone === 'Europe/Moscow') return null;

            return {
                start: this.getLastWeekdayOfMonth(year, 2, 0), // Last Sunday of March
                end: this.getLastWeekdayOfMonth(year, 9, 0)    // Last Sunday of October
            };
        }

        // Australia: 1st Sunday in October to 1st Sunday in April
        if (timezone.startsWith('Australia/')) {
            // Queensland and Northern Territory don't observe DST
            if (timezone === 'Australia/Brisbane' || timezone === 'Australia/Darwin') {
                return null;
            }

            return {
                start: this.getNthWeekdayOfMonth(year, 9, 0, 1),  // 1st Sunday of October
                end: this.getNthWeekdayOfMonth(year, 3, 0, 1)     // 1st Sunday of April (next year)
            };
        }

        // New Zealand: Last Sunday in September to 1st Sunday in April
        if (timezone.startsWith('Pacific/Auckland') || timezone.startsWith('Pacific/Fiji')) {
            return {
                start: this.getLastWeekdayOfMonth(year, 8, 0),   // Last Sunday of September
                end: this.getNthWeekdayOfMonth(year, 3, 0, 1)     // 1st Sunday of April
            };
        }

        // Most of Africa, Asia, and other regions don't observe DST
        return null;
    }

    /**
     * Check if a date is in DST period
     * @param {Date} date
     * @param {object} dstRules - {start: Date, end: Date}
     * @returns {boolean}
     */
    isDateInDST(date, dstRules) {
        if (!dstRules) return false;

        const timestamp = date.getTime();
        const startTime = dstRules.start.getTime();
        const endTime = dstRules.end.getTime();

        // Southern hemisphere (end date is in next year)
        if (endTime < startTime) {
            return timestamp >= startTime || timestamp < endTime;
        }

        // Northern hemisphere
        return timestamp >= startTime && timestamp < endTime;
    }

    /**
     * Helper function to get timezone offset from timezone string with DST support
     * @param {string} timezoneString
     * @param {Date} date - The date to calculate offset for
     * @returns {number} Offset in minutes
     */
    getTimezoneOffset(timezoneString, date) {
        // Validate inputs
        if (!timezoneString) {
            console.error('[Timezone] No timezone provided, defaulting to UTC');
            return 0;
        }

        if (!date) {
            date = new Date();
        }

        // Base offsets (standard time)
        const baseOffsets = {
            // North America
            "America/New_York": -300,      // EST
            "America/Chicago": -360,       // CST
            "America/Denver": -420,        // MST
            "America/Los_Angeles": -480,   // PST
            "America/Anchorage": -540,     // AKST
            "America/Phoenix": -420,       // MST (no DST)
            "America/Toronto": -300,       // EST
            "America/Vancouver": -480,     // PST
            "America/Mexico_City": -360,   // CST

            // South America
            "America/Sao_Paulo": -180,
            "America/Argentina/Buenos_Aires": -180,

            // Europe
            "Europe/London": 0,            // GMT
            "Europe/Dublin": 0,
            "Europe/Paris": 60,            // CET
            "Europe/Berlin": 60,
            "Europe/Rome": 60,
            "Europe/Madrid": 60,
            "Europe/Amsterdam": 60,
            "Europe/Brussels": 60,
            "Europe/Vienna": 60,
            "Europe/Stockholm": 60,
            "Europe/Athens": 120,          // EET
            "Europe/Helsinki": 120,
            "Europe/Istanbul": 180,
            "Europe/Moscow": 180,          // MSK (no DST since 2014)

            // Africa (Most don't observe DST)
            "Africa/Cairo": 120,           // EET
            "Africa/Johannesburg": 120,    // SAST (no DST)
            "Africa/Lagos": 60,            // WAT (no DST)
            "Africa/Nairobi": 180,         // EAT (no DST)
            "Africa/Kampala": 180,         // EAT (no DST) - Uganda
            "Africa/Dar_es_Salaam": 180,   // EAT (no DST) - Tanzania
            "Africa/Addis_Ababa": 180,     // EAT (no DST) - Ethiopia
            "Africa/Kigali": 120,          // CAT (no DST) - Rwanda
            "Africa/Casablanca": 60,       // WET

            // Asia (Most don't observe DST)
            "Asia/Dubai": 240,             // GST (no DST)
            "Asia/Kolkata": 330,           // IST (no DST)
            "Asia/Mumbai": 330,            // IST (no DST)
            "Asia/Karachi": 300,           // PKT (no DST)
            "Asia/Dhaka": 360,             // BST (no DST)
            "Asia/Bangkok": 420,           // ICT (no DST)
            "Asia/Singapore": 480,         // SGT (no DST)
            "Asia/Hong_Kong": 480,         // HKT (no DST)
            "Asia/Shanghai": 480,          // CST (no DST)
            "Asia/Taipei": 480,            // CST (no DST)
            "Asia/Tokyo": 540,             // JST (no DST)
            "Asia/Seoul": 540,             // KST (no DST)
            "Asia/Jakarta": 420,           // WIB (no DST)
            "Asia/Manila": 480,            // PHT (no DST)
            "Asia/Riyadh": 180,            // AST (no DST)
            "Asia/Jerusalem": 120,         // IST

            // Pacific
            "Pacific/Auckland": 720,       // NZST
            "Pacific/Fiji": 720,
            "Pacific/Honolulu": -600,      // HST (no DST)
            "Pacific/Sydney": 600,

            // Australia
            "Australia/Sydney": 600,       // AEST
            "Australia/Melbourne": 600,    // AEST
            "Australia/Brisbane": 600,     // AEST (no DST)
            "Australia/Perth": 480,        // AWST (no DST)
            "Australia/Adelaide": 570,     // ACST

            // Universal
            "UTC": 0,
            "GMT": 0,
        };

        const baseOffset = baseOffsets[timezoneString];

        if (baseOffset === undefined) {
            console.error(`[Timezone] Unknown timezone: "${timezoneString}", defaulting to UTC. Please add this timezone to the baseOffsets map.`);
            return 0;
        }

        // Check if timezone observes DST
        const year = date.getFullYear();
        const dstRules = this.getDSTRules(timezoneString, year);

        if (!dstRules) {
            // No DST for this timezone
            console.log(`[Timezone] ${timezoneString} at ${date.toISOString()}: offset = ${baseOffset} minutes (no DST)`);
            return baseOffset;
        }

        // Check if date falls within DST period
        const isDST = this.isDateInDST(date, dstRules);
        const offset = isDST ? baseOffset + 60 : baseOffset;

        console.log(`[Timezone] ${timezoneString} at ${date.toISOString()}: offset = ${offset} minutes (${isDST ? 'DST' : 'Standard Time'})`);
        return offset;
    }

    /**
     * Converts a local date/time to UTC based on timezone
     * @param {Date} _date - The deadline date
     * @param {string} timezone - IANA timezone string (e.g., "Africa/Kampala")
     * @param {string} reminder_time - Format: "HH:MM" in local time
     * @returns {Date} - UTC datetime for the reminder
     */
    getUTCLocalizedDateTime(_date, timezone, reminder_time) {
        const date = new Date(_date);

        // Log input parameters for debugging
        console.log(`[UTC Conversion] Input: date=${date.toISOString()}, timezone=${timezone}, reminder_time=${reminder_time}`);

        // Get timezone offset for the specific date (handles DST)
        const timezoneOffset = this.getTimezoneOffset(timezone, date);

        // Parse reminder time
        const [hours, minutes] = reminder_time.split(":").map(Number);

        // Convert local time to minutes since midnight
        const customerLocalMinutes = hours * 60 + minutes;

        // Calculate UTC time in minutes
        // For positive offsets (east of UTC): subtract offset
        // For negative offsets (west of UTC): subtract negative = add
        const customerTimeInUTC = customerLocalMinutes - timezoneOffset;

        // Normalize to 0-1439 range
        const normalizedUTCTime = ((customerTimeInUTC % 1440) + 1440) % 1440;

        const utcHours = Math.floor(normalizedUTCTime / 60);
        const utcMinutes = normalizedUTCTime % 60;

        // Create UTC datetime
        const reminderDateTimeUTC = new Date(Date.UTC(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            utcHours,
            utcMinutes,
            0,
            0
        ));

        // Adjust date if time wrapped around
        if (customerTimeInUTC < 0) {
            // Time is in previous day
            reminderDateTimeUTC.setUTCDate(reminderDateTimeUTC.getUTCDate() - 1);
            console.log(`[UTC Conversion] Adjusted to previous day (time wrapped backward)`);
        } else if (customerTimeInUTC >= 1440) {
            // Time is in next day
            reminderDateTimeUTC.setUTCDate(reminderDateTimeUTC.getUTCDate() + 1);
            console.log(`[UTC Conversion] Adjusted to next day (time wrapped forward)`);
        }

        console.log(`[UTC Conversion] Result: ${reminderDateTimeUTC.toISOString()} (offset=${timezoneOffset} minutes)`);
        return reminderDateTimeUTC;
    }
}

