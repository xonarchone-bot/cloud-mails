import { defineStore } from 'pinia'

export const useSettingStore = defineStore('setting', {
    state: () => ({
        domainList: [],
        settings: {
            r2Domain: '',
            loginOpacity: 1.00,
            loginDarkenFactor: 0,
            anonymousReceive: 0,
            anonymousReceiveCount: 10,
            anonymousReceiveDays: 0,
            anonymousReceiveRefresh: 10,
            anonymousReceiveBlacklist: '',
            anonymousReceiveRegisteredUser: 0,
            anonymousReceiveDomains: [],
        },
        lang: '',
    }),
    actions: {

    },
    persist: {
        pick: ['lang'],
    },
})
