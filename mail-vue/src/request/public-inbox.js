import http from '@/axios/index.js';

export function publicInboxList(address, emailId, timeSort, size) {
    return http.get('/public-inbox/list', {params: {address, emailId, timeSort, size}})
}

export function publicInboxLatest(address, emailId) {
    return http.get('/public-inbox/latest', {params: {address, emailId}, noMsg: true, timeout: 35 * 1000})
}

export function publicInboxRandom() {
    return http.get('/public-inbox/random')
}

export function publicInboxDetail(address, emailId) {
    return http.get('/public-inbox/detail', {params: {address, emailId}})
}
