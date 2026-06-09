<template>
    <Sheet>
        <SheetTrigger>
            <slot />
        </SheetTrigger>

        <SheetContent class="max-w-vw w-full md:max-w-sm">
            <SheetHeader>
                <SheetTitle>Reminders</SheetTitle>
                <SheetDescription>View and manage your reminders.</SheetDescription>
            </SheetHeader>

            <div class="flex flex-col w-full h-full bg-red-500"></div>
        </SheetContent>
    </Sheet>
</template>