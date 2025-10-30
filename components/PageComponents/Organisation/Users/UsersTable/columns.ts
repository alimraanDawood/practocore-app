import { h } from 'vue'
import { type ColumnDef } from '@tanstack/vue-table';
import type {UsersRecord} from "~/lib/pocketbase-types";
import UserProfile from "~/components/PageComponents/Organisation/Users/UsersTable/UserProfile.vue";
import { Button } from '@/components/ui/button';
import {EllipsisVertical} from "lucide-vue-next";

export const desktopColumns: ColumnDef<UsersRecord>[] = [
    {
        accessorKey: 'name',
        header: () => h('div', { class: 'font-semibold ibm-plex-serif' }, 'Name'),
        cell: ({ row }) => {
            return h(UserProfile, { user: row.original });
        }
    },
    {
        accessorKey: 'email',
        header: () => h("div", { class: 'font-semibold ibm-plex-serif' }, 'Email'),
        cell: ({ row }) => {
            return h('span', { class: 'font-semibold ibm-plex-serif' }, row.original.email);
        }
    },
    {
        accessorKey: 'permissions',
        header: () => 'Permissions',
        cell: ({ row }) => {
            return h(Button, { variant: 'secondary', size: 'sm' }, '0 Permissions Granted')
        }
    }
]

export const mobileColumns: ColumnDef<UsersRecord>[] = [
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