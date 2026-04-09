import { ReminderGenerator } from "~/services/intelligence/reminder";

export { searchWithAI, getAvailableModels } from "~/services/intelligence/search";
export type { SearchResponse, SearchResultGroup, SearchResultItem, SearchModelInfo } from "~/services/intelligence/search";

export const reminderGenerator = new ReminderGenerator();
