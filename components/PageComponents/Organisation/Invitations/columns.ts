import { h } from 'vue'
import { type ColumnDef } from '@tanstack/vue-table';
import type {UsersRecord} from "~/lib/pocketbase-types";
import UserProfile from "~/components/PageComponents/Organisation/Users/UsersTable/UserProfile.vue";
import { Button } from '@/components/ui/button';
import {EllipsisVertical} from "lucide-vue-next";
import {toast} from "vue-sonner";
import {approveInvite} from "~/services/admin";

export const desktopColumns: ColumnDef<any>[] = [
    {
        accessorKey: 'name',
        header: () => h('div', { class: 'font-semibold ibm-plex-serif' }, 'Name'),
        cell: ({ row }) => {
            return h(UserProfile, { user: { name: row.original?.name, avatar: row.original?.avatar } });
        }
    },
    {
        accessorKey: 'action',
        header: () => 'Accept',
        cell: ({ row }) => {
            return h(Button, { size: 'sm', onClick: async () => {
                    try {
                        const result = await approveInvite(row.original.id);

                        toast.success("Successfully approved invite!");
                    } catch (e) {
                        console.error(e);
                        toast.error("We were unable to approve this invite!")
                    }
                } }, 'Approve')
        }
    }
]

export const mobileColumns: ColumnDef<any>[] = [
    {
        accessorKey: 'name',
        header: () => h('div', { class: 'font-semibold ibm-plex-serif' }, 'Name'),
        cell: ({ row }) => {
            return h(UserProfile, { user: row.original });
        }
    },
    {
        accessorKey: 'permissions',
        header: () => '',
        cell: ({ row }) => {
            return h('div', { class: 'flex flex-row w-full items-center justify-end' }, h(Button, { variant: 'secondary', class: 'size-8', size: 'icon' }, h(EllipsisVertical, { class: "size-4" })));
        }
    }
]