import {computed} from "vue";

export default function useTauri() {

    const isTauri = '__TAURI_INTERNALS__' in window;

    return {
        isTauri,
    }
}