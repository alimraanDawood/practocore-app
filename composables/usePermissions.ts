import { getUserPermissions } from "~/services/auth";

interface UserPermissions {
    role: string;
    isAdmin: boolean;
    organisationId?: string;
    [key: string]: boolean | string | undefined;
}

// Singleton state — shared across all components
const permissions = ref<UserPermissions | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
let fetched = false;

export const usePermissions = () => {
    const fetchPermissions = async () => {
        if(usePlanActive()?.value?.type === "individual") {
            return;
        }

        loading.value = true;
        error.value = null;
        try {
            const res = await getUserPermissions();
            if (!res.ok) {
                throw new Error(`Failed to fetch permissions: ${res.statusText}`);
            }
            permissions.value = await res.json();
            fetched = true;
        } catch (err: any) {
            error.value = err?.message ?? "Failed to fetch permissions";
        } finally {
            loading.value = false;
        }
    };

    // Auto-fetch in the background on first use
    if (!fetched && !loading.value) {
        fetchPermissions();
    }

    const hasPermission = (permission: string): boolean => {
        if (usePlanActive()?.value?.type === "individual") return true;
        if (!permissions.value) return false;
        if (permissions.value.isAdmin) return true;
        return permissions.value?.permissions?.includes(permission) === true;
    };

    const isAdmin = computed(() => permissions.value?.isAdmin ?? false);
    const role = computed(() => permissions.value?.role ?? null);

    return {
        permissions,
        loading,
        error,
        fetchPermissions,
        hasPermission,
        isAdmin,
        role,
    };
};
