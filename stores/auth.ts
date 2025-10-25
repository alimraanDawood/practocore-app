import { defineStore } from 'pinia';
import { getSignedInUser} from "~/services/auth";

const useAuthStore = defineStore('auth', {
    state: () => ({
        pb: getSignedInUser(),
        organisation: null
    }),

});