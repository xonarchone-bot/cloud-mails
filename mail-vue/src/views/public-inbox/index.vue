<template>
  <div class="public-inbox">
    <div v-if="background" class="public-background" :style="background"></div>
    <div v-else class="public-clouds">
      <div class="x1 public-cloud"></div>
      <div class="x2 public-cloud"></div>
      <div class="x3 public-cloud"></div>
      <div class="x4 public-cloud"></div>
      <div class="x5 public-cloud"></div>
    </div>
    <button
        class="back-button"
        type="button"
        :title="$t('publicInboxBackMailbox')"
        :aria-label="$t('publicInboxBackMailbox')"
        @click="goMailbox"
    >
      <Icon icon="material-symbols:arrow-back-rounded" width="20" height="20" />
    </button>
    <main class="public-page">
      <div v-if="mobileToolsOpen" class="mobile-tools-overlay" @click="mobileToolsOpen = false"></div>
      <aside class="history-panel history-floating" :class="{ 'mobile-tools-open': mobileToolsOpen }">
        <div class="history-head">
          <span>{{ $t('history') }}</span>
          <el-button v-if="historyRecords.length" text size="small" @click="clearHistory">
            {{ $t('clear') }}
          </el-button>
        </div>
        <div v-if="historyRecords.length" class="history-list">
          <div
              v-for="address in historyRecords"
              :key="address"
              class="history-row"
          >
            <button
                class="history-item"
                type="button"
                @click="openHistory(address)"
            >
              {{ address }}
            </button>
            <button
                class="history-remove"
                type="button"
                :aria-label="$t('delete')"
                @click.stop="removeHistory(address)"
            >
              <Icon icon="material-symbols:close-rounded" width="14" height="14" />
            </button>
          </div>
        </div>
        <div v-else class="history-empty">{{ $t('publicInboxEmptyHistory') }}</div>
      </aside>

      <section class="search-area">
        <div class="start-lookup">
          <div class="lookup-control">
            <div class="mobile-actions-group">
              <button
                  class="mobile-action-button mobile-action-left"
                  type="button"
                  :title="mobileToolsOpen ? $t('collapse') : $t('expand')"
                  :aria-label="mobileToolsOpen ? $t('collapse') : $t('expand')"
                  @click="mobileToolsOpen = !mobileToolsOpen"
              >
                <Icon :icon="mobileToolsOpen ? 'material-symbols:close-rounded' : 'material-symbols:menu-rounded'" width="18" height="18" />
              </button>
              <button
                  class="mobile-action-button mobile-action-right"
                  type="button"
                  :disabled="loading"
                  :title="$t('publicInboxRandom')"
                  :aria-label="$t('publicInboxRandom')"
                  @click="randomAddress"
              >
                <Icon icon="ion:shuffle" width="16" height="16" />
              </button>
            </div>
            <button
                class="mobile-tools-button"
                :class="{ active: mobileToolsOpen }"
                type="button"
                :title="mobileToolsOpen ? $t('collapse') : $t('expand')"
                :aria-label="mobileToolsOpen ? $t('collapse') : $t('expand')"
                @click="mobileToolsOpen = !mobileToolsOpen"
            >
              <Icon :icon="mobileToolsOpen ? 'material-symbols:close-rounded' : 'material-symbols:menu-rounded'" width="20" height="20" />
            </button>
            <button
                class="random-email-button"
                type="button"
                :disabled="loading"
                :title="$t('publicInboxRandom')"
                :aria-label="$t('publicInboxRandom')"
                @click="randomAddress"
            >
              <Icon class="icon" icon="ion:shuffle" width="18" height="18" />
            </button>
            <el-input
                v-model.trim="form.address"
                class="email-input"
                type="text"
                :placeholder="$t('publicInboxPlaceholder')"
                clearable
                autocomplete="off"
                @paste="handleAddressPaste"
                @keyup.enter="search"
            >
              <template #append>
                <div class="suffix-trigger" :style="{ '--suffix-min-width': suffixDisplayMinWidth }" @click.stop="openSuffixSelect">
                  <el-select
                      ref="suffixSelect"
                      v-model="suffix"
                      class="suffix-select"
                      :placeholder="$t('select')"
                      placement="bottom-start"
                      :fallback-placements="['bottom-start']"
                  >
                    <el-option
                        v-for="item in domainList"
                        :key="item"
                        :label="item"
                        :value="item"
                    />
                  </el-select>
                  <div class="suffix-display">
                    <span>{{ suffix }}</span>
                    <Icon class="setting-icon" icon="mingcute:down-small-fill" width="20" height="20" />
                  </div>
                </div>
              </template>
            </el-input>
            <div class="lookup-actions">
              <button class="open-button" type="button" :disabled="loading" :title="$t('publicInboxOpen')" :aria-label="$t('publicInboxOpen')" @click="search">
                <Icon icon="material-symbols:search-rounded" width="18" height="18" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section class="result-area">
        <div v-if="displayAddress" class="result-meta">
          <button class="result-address" type="button" :title="$t('copy')" @click="copyCurrentAddress">
            {{ displayAddress }}
          </button>
          <span
              v-if="displayAddress"
              class="auto-refresh-icon"
              :class="{ active: autoRefreshActive, loading: loading || refreshLoading }"
              :style="{ '--refresh-duration': `${autoRefreshInterval}s` }"
              :aria-hidden="true"
          >
            <span class="auto-refresh-track"></span>
            <span :key="autoRefreshCycle" class="auto-refresh-sector"></span>
          </span>
          <button
              class="share-link-button"
              type="button"
              :disabled="!shareLinkUrl"
              :title="$t('publicInboxShareLink')"
              :aria-label="$t('publicInboxShareLink')"
              @click="copyShareLink"
          >
            <Icon icon="material-symbols:link-rounded" width="18" height="18" />
          </button>
        </div>
        <div v-if="firstLoad" class="empty-state">
          <el-empty :description="$t('publicInboxEmptyGuide')" />
        </div>
        <template v-else>
          <div v-if="loading && list.length === 0" class="loading-state">
            <el-skeleton :rows="8" animated />
          </div>
          <div v-else-if="list.length === 0" class="empty-state">
            <el-empty :description="$t('noMessagesFound')" />
          </div>
        <template
            v-for="item in list"
            :key="item.emailId"
          >
            <button
                class="email-row"
                :class="{ active: selected?.emailId === item.emailId }"
                type="button"
                @click="openDetail(item)"
            >
              <div class="row-title">
                <div class="email-sender">
                  <span class="name">{{ item.name || item.sendEmail || $t('unknown') }}</span>
                  <span class="phone-time">{{ fromNow(item.createTime) }}</span>
                </div>
                <div class="email-text">
                  <span class="email-subject">
                    <span v-if="item.code" class="code-tag">[{{ $t('codeLabel') }}{{ item.code }}]</span>
                    <span class="subject-text">{{ item.subject || '\u200B' }}</span>
                  </span>
                  <span class="email-content">{{ item.preview || '\u200B' }}</span>
                </div>
              </div>
              <div class="email-right">
              <span class="email-time">{{ fromNow(item.createTime) }}</span>
            </div>
          </button>
          </template>
          <div class="load-more" v-if="list.length > 0">
            <el-button text :disabled="noMore || loadingMore" :loading="loadingMore" @click="loadMore">
              {{ noMore ? $t('noMoreData') : $t('publicInboxLoadMore') }}
            </el-button>
          </div>
        </template>
        <div class="scope-hint">
          {{ publicInboxScopeLabel }}
        </div>
      </section>
    </main>

    <el-dialog
        v-model="detailOpen"
        class="public-inbox-dialog"
        width="920px"
        :style="{ height: 'calc(100vh - 48px)' }"
        :body-style="{ paddingTop: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: '0' }"
        align-center
        destroy-on-close
        :close-on-click-modal="true"
        :append-to-body="true"
        @close="closeDetail"
    >
      <template #header>
        <div class="dialog-header">
          <span class="dialog-title">{{ selected?.subject || $t('noSubject') }}</span>
          <span v-if="selected?.createTime" class="dialog-subtitle">{{ formatDetailDate(selected.createTime) }}</span>
        </div>
      </template>
      <div v-if="selected" class="detail-container">
        <div class="detail-head">
          <div class="email-info">
            <div class="send">
              <span class="send-source">{{ $t('from') }}</span>
              <div class="send-name">
                <span class="send-name-title">{{ selected.name }}</span>
                <span>&lt;{{ selected.sendEmail }}&gt;</span>
              </div>
            </div>
            <div class="receive">
              <span class="source">{{ $t('recipient') }}</span>
              <span class="receive-email">{{ formatReceive(selected) }}</span>
            </div>
          </div>
        </div>
        <el-scrollbar class="detail-scroll">
          <div class="content">
            <div v-if="detailLoading && !selected.content && !selected.text" class="detail-body-loading">
              <el-skeleton :rows="8" animated />
            </div>
            <template v-else>
              <ShadowHtml class="shadow-html" :html="formatImage(selected.content)" v-if="selected.content" />
              <pre class="email-plain-text" v-else>{{ selected.text }}</pre>
            </template>
            <div class="att" v-if="selected.attList?.length">
              <div class="att-title">
                <span>{{ $t('attachments') }}</span>
                <span>{{ $t('attCount', {total: selected.attList.length}) }}</span>
              </div>
              <div class="att-box">
                <a
                    v-for="att in selected.attList"
                    :key="att.attId"
                    class="att-item"
                    :href="cvtR2Url(att.key)"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                  <Icon v-bind="getIconByName(att.filename)" />
                  <span>{{ att.filename }}</span>
                </a>
              </div>
            </div>
          </div>
        </el-scrollbar>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import {computed, onMounted, onUnmounted, reactive, ref, watch} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import {Icon} from '@iconify/vue'
import {debounce} from 'lodash-es'
import ShadowHtml from '@/components/shadow-html/index.vue'
import {publicInboxDetail, publicInboxLatest, publicInboxList} from '@/request/public-inbox.js'
import {isEmail} from '@/utils/verify-utils.js'
import {fromNow, formatDetailDate} from '@/utils/day.js'
import {cvtR2Url, toOssDomain} from '@/utils/convert.js'
import {getIconByName} from '@/utils/icon-utils.js'
import {useSettingStore} from '@/store/setting.js'
import {useI18n} from 'vue-i18n'
import {sleep} from '@/utils/time-utils.js'
import './public-inbox.css'

const route = useRoute()
const router = useRouter()
const settingStore = useSettingStore()
const {t} = useI18n()

const form = reactive({
  address: ''
})
const domainList = computed(() => {
  const publicDomains = normalizeDomainList(settingStore.settings.anonymousReceiveDomains)
  if (publicDomains.length) {
    return publicDomains
  }
  return normalizeDomainList(settingStore.domainList)
})
const suffix = ref('')
const suffixSelect = ref()
const list = ref([])
const selected = ref(null)
const detailOpen = ref(false)
const detailLoading = ref(false)
const selectedEmailId = ref(0)
let detailSeq = 0
const currentAddress = ref('')
const total = ref(0)
const latestEmailId = ref(0)
const loading = ref(false)
const refreshLoading = ref(false)
const loadingMore = ref(false)
const firstLoad = ref(true)
const noMore = ref(false)
const autoRefreshActive = ref(false)
const autoRefreshSuspended = ref(false)
const autoRefreshCycle = ref(0)
const historyRecords = ref([])
const inboxReady = ref(false)
const autoSearchPaused = ref(false)
const mobileToolsOpen = ref(false)
let stopped = false
const historyKey = 'public-inbox-history'
let searchSeq = 0
let autoRefreshVersion = 0
let awayPauseTimer = 0
const awayPauseDelay = 3 * 60 * 1000
const anonymousReceiveEnabled = computed(() => settingStore.settings.anonymousReceive === 0)
const background = computed(() => {
  return settingStore.settings.background ? {
    'background-image': `url(${cvtR2Url(settingStore.settings.background)})`
  } : null
})

const anonymousReceiveCount = computed(() => {
  const count = Number(settingStore.settings.anonymousReceiveCount ?? 10)
  if (count === -1) {
    return -1
  }
  if (Number.isNaN(count) || count < 0) {
    return 10
  }
  return Math.min(count, 50)
})
const anonymousReceiveDays = computed(() => {
  const days = Number(settingStore.settings.anonymousReceiveDays ?? 0)
  if (Number.isNaN(days) || days < 0) {
    return 0
  }
  return Math.min(days, 365)
})
const anonymousReceivePageSize = computed(() => {
  if (anonymousReceiveCount.value === -1) {
    return 50
  }
  return anonymousReceiveCount.value
})
const publicInboxScopeLabel = computed(() => {
  const count = anonymousReceiveCount.value
  const days = anonymousReceiveDays.value

  if (count === 0) {
    return t('publicInboxScopeEmpty')
  }
  if (count === -1 && days <= 0) {
    return t('publicInboxScopeAll')
  }
  if (days > 0 && count > 0) {
    return t('publicInboxScopeCountDays', {days, count})
  }
  if (days > 0) {
    return t('publicInboxScopeDays', {days})
  }
  return t('publicInboxScopeCount', {count})
})

const autoRefreshInterval = computed(() => {
  const value = Number(settingStore.settings.anonymousReceiveRefresh ?? 10)
  return value > 1 ? value : 10
})

const suffixDisplayMinWidth = computed(() => {
  const longest = domainList.value.reduce((max, item) => Math.max(max, String(item).length), 0)
  return `${Math.max(11, longest + 1)}ch`
})

const inputAddress = computed(() => getSearchAddress())

const displayAddress = computed(() => {
  if (currentAddress.value) {
    return currentAddress.value
  }
  return firstLoad.value && isEmail(inputAddress.value) ? inputAddress.value : ''
})

const shareLinkUrl = computed(() => {
  const address = displayAddress.value
  if (!isEmail(address)) {
    return ''
  }

  const url = new URL(window.location.origin)
  url.pathname = '/public-inbox'
  url.searchParams.set('email', address)
  return url.toString()
})

const newestEmailId = computed(() => {
  return list.value.reduce((max, item) => Math.max(max, item.emailId), latestEmailId.value || 0)
})

watch(domainList, (list) => {
  if (!list.length) {
    suffix.value = ''
    return
  }
  if (!suffix.value || !list.includes(suffix.value)) {
    suffix.value = list[0]
  }
}, {immediate: true})

const scheduleAutoSearch = debounce(() => {
  if (!inboxReady.value || autoSearchPaused.value) {
    return
  }

  const address = getSearchAddress()
  if (!address || !isEmail(address) || address === currentAddress.value) {
    return
  }

  search()
}, 350)

onMounted(async () => {
  historyRecords.value = loadHistory()
  const initialRouteAddress = getInitialRouteAddress()
  normalizePublicInboxUrl()
  if (initialRouteAddress) {
    applyPreviewAddressValue(initialRouteAddress, true)
  }
  if (isEmail(getSearchAddress())) {
    search().finally(() => {
      inboxReady.value = true
      autoSearchPaused.value = false
    })
  } else {
    inboxReady.value = true
    autoSearchPaused.value = false
  }
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('focus', handlePageFocus)
  window.addEventListener('blur', handlePageBlur)
  refreshLatestLoop()
})

onUnmounted(() => {
  stopped = true
  clearAwayPauseTimer()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('focus', handlePageFocus)
  window.removeEventListener('blur', handlePageBlur)
})

function normalizeList(rows) {
  return rows.map(item => ({
    ...item,
    preview: htmlToText(item.text || '')
  }))
}

function normalizeDomainList(value) {
  return Array.from(new Set(
      (Array.isArray(value) ? value : String(value || '').split(','))
          .map(item => String(item || '').trim())
          .filter(Boolean)
          .map(item => item.startsWith('@') ? item : `@${item}`)
  ))
}

function getInitialRouteAddress() {
  const address = route.query.email || route.query.address || route.params.email || ''
  if (Array.isArray(address)) {
    return address[0] || ''
  }
  return typeof address === 'string' ? address.trim() : ''
}

function normalizePublicInboxUrl() {
  const canonical = router.resolve({name: 'publicInbox'})
  if (route.fullPath === canonical.fullPath) {
    return
  }
  router.replace({name: 'publicInbox'}).catch(() => {})
}

function htmlToText(text) {
  return (text || '').replace(/[\u200B-\u200F\uFEFF\u034F\u00A0\u3000\u00AD]/g, '').replace(/\s+/g, ' ').trim()
}

async function search() {
  const address = getSearchAddress()
  if (!address) {
    ElMessage({message: t('emptyEmailMsg'), type: 'error', plain: true})
    return
  }
  if (!isEmail(address)) {
    ElMessage({message: t('notEmailMsg'), type: 'error', plain: true})
    return
  }
  if (!anonymousReceiveEnabled.value) {
    ElMessage({message: t('anonymousReceiveClosed'), type: 'warning', plain: true})
    return
  }

  const addressChanged = address !== currentAddress.value
  applyAddressValue(address)
  closeDetail()
  currentAddress.value = address
  if (addressChanged) {
    list.value = []
    total.value = 0
    latestEmailId.value = 0
  }
  stopAutoRefreshCountdown()
  loading.value = true
  firstLoad.value = false
  noMore.value = false
  const seq = ++searchSeq

  try {
    const data = await publicInboxList(address, 0, 0, anonymousReceivePageSize.value)
    if (seq !== searchSeq) {
      return
    }
    saveHistory(address)
    list.value = normalizeList(data.list)
    total.value = data.total
    latestEmailId.value = data.latestEmail?.emailId || 0
    noMore.value = list.value.length >= total.value
  } finally {
    if (seq === searchSeq) {
      loading.value = false
      refreshLoading.value = false
      resetAutoRefreshWait()
    }
  }
}

function randomAddress() {
  const selectedSuffix = suffix.value || domainList.value[0] || ''
  if (!selectedSuffix) {
    ElMessage({message: t('emptyEmailMsg'), type: 'error', plain: true})
    return
  }

  scheduleAutoSearch.cancel()
  autoSearchPaused.value = true
  suffix.value = selectedSuffix
  form.address = createRandomLocal()
  autoSearchPaused.value = false
}

function createRandomLocal() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const length = Math.floor(Math.random() * 5) + 6
  let value = ''
  for (let i = 0; i < length; i++) {
    value += chars[Math.floor(Math.random() * chars.length)]
  }
  return value
}

function openSuffixSelect() {
  suffixSelect.value?.toggleMenu()
}

function goMailbox() {
  mobileToolsOpen.value = false
  const token = localStorage.getItem('token')
  router.replace(token ? '/inbox' : '/login')
}

async function copyCurrentAddress() {
  if (!displayAddress.value) {
    return
  }

  try {
    await navigator.clipboard.writeText(displayAddress.value)
    ElMessage({message: t('copySuccessMsg'), type: 'success', plain: true})
  } catch (e) {
    ElMessage({message: t('copyFailMsg'), type: 'error', plain: true})
  }
}

async function copyShareLink() {
  if (!shareLinkUrl.value) {
    return
  }

  try {
    await navigator.clipboard.writeText(shareLinkUrl.value)
    ElMessage({message: t('copySuccessMsg'), type: 'success', plain: true})
  } catch (e) {
    ElMessage({message: t('copyFailMsg'), type: 'error', plain: true})
  }
}

function getSearchAddress() {
  const value = form.address.trim()
  if (!value) {
    return ''
  }
  if (value.includes('@')) {
    return value.toLowerCase()
  }
  const selectedSuffix = suffix.value || domainList.value[0] || ''
  return `${value}${selectedSuffix}`.toLowerCase()
}

function splitAddress(value) {
  const text = (value || '').trim()
  const fallbackSuffix = suffix.value || domainList.value[0] || ''
  if (!text) {
    return {local: '', suffix: fallbackSuffix}
  }

  const index = text.indexOf('@')
  if (index <= 0) {
    return {local: text, suffix: fallbackSuffix}
  }

  const local = text.slice(0, index)
  const emailSuffix = text.slice(index)
  const matched = domainList.value.find(item => item.toLowerCase() === emailSuffix.toLowerCase())
  if (matched) {
    return {local, suffix: matched}
  }

  return {local: text, suffix: fallbackSuffix}
}

function applyAddressValue(value, pauseAutoSearch = false) {
  autoSearchPaused.value = pauseAutoSearch
  if (pauseAutoSearch) {
    scheduleAutoSearch.cancel()
  }
  const parsed = splitAddress(value)
  form.address = parsed.local
  if (parsed.suffix) {
    suffix.value = parsed.suffix
  }
}

function applyPreviewAddressValue(value, pauseAutoSearch = false) {
  autoSearchPaused.value = pauseAutoSearch
  if (pauseAutoSearch) {
    scheduleAutoSearch.cancel()
  }

  const text = (value || '').trim()
  const fallbackSuffix = suffix.value || domainList.value[0] || ''
  if (!text) {
    form.address = ''
    if (fallbackSuffix) {
      suffix.value = fallbackSuffix
    }
    return
  }

  const index = text.indexOf('@')
  if (index <= 0) {
    form.address = text
    if (fallbackSuffix) {
      suffix.value = fallbackSuffix
    }
    return
  }

  const local = text.slice(0, index)
  const emailSuffix = text.slice(index)
  const matched = domainList.value.find(item => item.toLowerCase() === emailSuffix.toLowerCase())
  form.address = local
  suffix.value = matched || fallbackSuffix
}

function handleAddressPaste(event) {
  const text = event.clipboardData?.getData('text')?.trim()
  if (!text) {
    return
  }

  const parsed = splitAddress(text)
  if (parsed.local !== text || parsed.suffix !== suffix.value) {
    event.preventDefault()
    form.address = parsed.local
    if (parsed.suffix) {
      suffix.value = parsed.suffix
    }
  }
}

function loadHistory() {
  try {
    const list = JSON.parse(localStorage.getItem(historyKey) || '[]')
    return Array.isArray(list) ? list.filter(item => typeof item === 'string' && isEmail(item)).slice(0, 20) : []
  } catch (e) {
    return []
  }
}

function saveHistory(address) {
  historyRecords.value = [address, ...historyRecords.value.filter(item => item !== address)].slice(0, 20)
  localStorage.setItem(historyKey, JSON.stringify(historyRecords.value))
}

function removeHistory(address) {
  historyRecords.value = historyRecords.value.filter(item => item !== address)
  if (historyRecords.value.length) {
    localStorage.setItem(historyKey, JSON.stringify(historyRecords.value))
  } else {
    localStorage.removeItem(historyKey)
  }
}

function clearHistory() {
  historyRecords.value = []
  localStorage.removeItem(historyKey)
}

async function openHistory(address) {
  applyPreviewAddressValue(address, true)
  autoSearchPaused.value = false
  mobileToolsOpen.value = false
  await search()
}

async function loadMore() {
  if (!currentAddress.value || noMore.value || loadingMore.value) {
    return
  }

  loadingMore.value = true
  try {
    const last = list.value.at(-1)
    const data = await publicInboxList(currentAddress.value, last?.emailId || 0, 0, anonymousReceivePageSize.value)
    list.value.push(...normalizeList(data.list))
    total.value = data.total
    noMore.value = list.value.length >= total.value
  } finally {
    loadingMore.value = false
  }
}

async function openDetail(item) {
  if (detailOpen.value && selectedEmailId.value === item.emailId) {
    closeDetail()
    return
  }
  const seq = ++detailSeq
  selectedEmailId.value = item.emailId
  detailOpen.value = true
  detailLoading.value = true
  selected.value = {
    ...item,
    text: item.preview || '',
    content: '',
    attList: item.attList || [],
  }
  try {
    const data = await publicInboxDetail(currentAddress.value, item.emailId)
    if (seq !== detailSeq) {
      return
    }
    selected.value = {
      ...selected.value,
      ...data,
      attList: data.attList || selected.value?.attList || [],
    }
  } finally {
    if (seq === detailSeq) {
      detailLoading.value = false
    }
  }
}

function closeDetail() {
  detailSeq += 1
  detailOpen.value = false
  detailLoading.value = false
  selected.value = null
  selectedEmailId.value = 0
}

function stopAutoRefreshCountdown() {
  autoRefreshVersion += 1
  autoRefreshActive.value = false
  refreshLoading.value = false
  autoRefreshCycle.value += 1
}

function resetAutoRefreshWait() {
  autoRefreshVersion += 1
  autoRefreshActive.value = false
  refreshLoading.value = false
}

function clearAwayPauseTimer() {
  if (awayPauseTimer) {
    window.clearTimeout(awayPauseTimer)
    awayPauseTimer = 0
  }
}

function pauseAutoRefreshWhenAway() {
  if (awayPauseTimer || autoRefreshSuspended.value) {
    return
  }

  awayPauseTimer = window.setTimeout(() => {
    awayPauseTimer = 0
    if (!document.hidden && document.hasFocus()) {
      return
    }

    autoRefreshSuspended.value = true
    stopAutoRefreshCountdown()
  }, awayPauseDelay)
}

function resumeAutoRefreshWhenBack() {
  clearAwayPauseTimer()
  if (!autoRefreshSuspended.value) {
    return
  }

  autoRefreshSuspended.value = false
  resetAutoRefreshWait()
}

function handleVisibilityChange() {
  if (document.hidden) {
    pauseAutoRefreshWhenAway()
    return
  }

  resumeAutoRefreshWhenBack()
}

function handlePageFocus() {
  resumeAutoRefreshWhenBack()
}

function handlePageBlur() {
  pauseAutoRefreshWhenAway()
}

async function waitAutoRefreshInterval(seconds, version) {
  for (let i = 0; i < seconds && !stopped; i++) {
    await sleep(1000)
    if (version !== autoRefreshVersion || loading.value || !currentAddress.value || !anonymousReceiveEnabled.value || autoRefreshSuspended.value) {
      return false
    }
  }
  return true
}

async function refreshLatestLoop() {
  while (!stopped) {
    const autoRefresh = autoRefreshInterval.value
    if (!currentAddress.value || loading.value || !anonymousReceiveEnabled.value || autoRefresh <= 0 || autoRefreshSuspended.value) {
      autoRefreshActive.value = false
      await sleep(1000)
      continue
    }

    try {
      const version = autoRefreshVersion
      autoRefreshActive.value = true
      autoRefreshCycle.value += 1
      const shouldRefresh = await waitAutoRefreshInterval(autoRefresh, version)
      if (!shouldRefresh || version !== autoRefreshVersion || loading.value) {
        continue
      }
      refreshLoading.value = true
      const rows = await publicInboxLatest(currentAddress.value, newestEmailId.value)
      const known = new Set(list.value.map(item => item.emailId))
      const next = normalizeList(rows).filter(item => !known.has(item.emailId))
      if (next.length > 0) {
        list.value.unshift(...next)
        total.value += next.length
        latestEmailId.value = Math.max(...next.map(item => item.emailId), latestEmailId.value)
      }
    } catch (e) {
      console.error(e)
    } finally {
      refreshLoading.value = false
      autoRefreshActive.value = false
    }
  }
}

function formatImage(content) {
  const domain = settingStore.settings.r2Domain
  return (content || '').replace(/{{domain}}/g, toOssDomain(domain) + '/')
}

function formatReceive(email) {
  try {
    const recipient = JSON.parse(email.recipient || '[]')
    const value = recipient.map(item => item.address).filter(Boolean).join(', ')
    return value || email.toEmail
  } catch (e) {
    return email.toEmail
  }
}
</script>

<style scoped lang="scss">
.public-inbox {
  color: var(--el-text-color-primary);
  background: linear-gradient(to bottom, #2980b9, #6dd5fa, #fff);
  min-height: 100vh;
  overflow-x: hidden;
  position: relative;
}

.public-background,
.public-clouds {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.public-background {
  background-repeat: no-repeat;
  background-size: cover;
  background-position: center;
}

.public-clouds {
  overflow: hidden;
}

.public-page {
  min-height: 100vh;
  padding: 0 20px 48px;
  box-sizing: border-box;
  position: relative;
  z-index: 1;
}

@keyframes animateCloud {
  0% {
    margin-left: -500px;
  }

  100% {
    margin-left: 100%;
  }
}

.x1 {
  animation: animateCloud 30s linear infinite;
  transform: scale(0.65);
}

.x2 {
  animation: animateCloud 15s linear infinite;
  transform: scale(0.3);
}

.x3 {
  animation: animateCloud 25s linear infinite;
  transform: scale(0.5);
}

.x4 {
  animation: animateCloud 13s linear infinite;
  transform: scale(0.4);
}

.x5 {
  animation: animateCloud 20s linear infinite;
  transform: scale(0.55);
}

.public-cloud {
  background: linear-gradient(to bottom, #fff 5%, #f1f1f1 100%);
  border-radius: 100px;
  box-shadow: 0 8px 5px rgb(0 0 0 / 10%);
  height: 120px;
  width: 350px;
  position: relative;
}

.public-cloud::after,
.public-cloud::before {
  content: "";
  position: absolute;
  background: #fff;
  z-index: -1;
}

.public-cloud::after {
  border-radius: 100px;
  height: 100px;
  left: 50px;
  top: -50px;
  width: 100px;
}

.public-cloud::before {
  border-radius: 200px;
  height: 180px;
  width: 180px;
  right: 50px;
  top: -90px;
}

.search-area {
  padding-top: 16px;
}

.result-area {
  width: min(920px, 100%);
  margin: 0 auto;
}

.mail-shell {
  display: grid;
  grid-template-columns: minmax(420px, 42%) minmax(0, 1fr);
  height: 100%;
  min-height: 0;
}

.start-mode {
  .mail-shell {
    display: block;
  }

  .list-pane {
    height: 100%;
    box-shadow: none;
  }

  .detail-pane {
    display: none;
  }
}

.list-pane,
.detail-pane {
  min-height: 0;
  overflow: hidden;
}

.list-pane {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  box-shadow: inset -1px 0 0 0 var(--el-border-color-lighter);
}

.header-actions {
  display: grid;
  align-items: center;
  gap: 15px;
  padding: 3px 15px;
  min-height: 39px;
  box-shadow: var(--header-actions-border);

  .icon {
    cursor: pointer;
  }

  .disabled {
    cursor: not-allowed;
    opacity: 0.35;
  }

  .share-link-button {
    width: 24px;
    height: 24px;
    border-radius: 4px;
  }
}

.list-actions {
  grid-template-columns: auto minmax(0, 1fr) auto;
}

.lookup-control {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
}

.lookup-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.random-email-button {
  width: 38px;
  height: 38px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;

  &:hover {
    color: var(--el-color-primary);
    border-color: var(--el-color-primary);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.35;
  }
}

.open-button,
.share-link-button {
  width: 38px;
  height: 38px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
}

.open-button {
  border: 1px solid var(--el-border-color);
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);

  &:hover {
    color: var(--el-color-primary);
    border-color: var(--el-color-primary);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.35;
  }
}

.share-link-button {
  border: 0;
  background: transparent;
  color: var(--el-text-color-primary);

  &:hover:not(:disabled) {
    color: var(--el-color-primary);
    background: rgb(64 158 255 / 8%);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.35;
    background: transparent;
  }
}

.email-input {
  height: 38px;
  width: 100%;
}

.email-input :deep(.el-input__wrapper) {
  border-radius: 6px 0 0 6px;
  background: var(--el-bg-color);
}

.email-input :deep(.el-input__inner) {
  height: 36px;
}

.email-input :deep(.el-input-group__append) {
  padding: 0 !important;
  padding-left: 8px !important;
  padding-right: 4px !important;
  background: var(--el-bg-color);
  border-radius: 0 8px 8px 0;
}

.suffix-trigger {
  position: relative;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: var(--suffix-min-width);
  color: var(--el-text-color-primary);
  cursor: pointer;
}

.suffix-display {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 4px;
  width: max-content;
}

.suffix-display span {
  overflow: visible;
  white-space: nowrap;
  text-overflow: clip;
}

.setting-icon {
  flex: 0 0 auto;
}

.suffix-select {
  position: absolute;
  right: 30px;
  width: 100px;
  opacity: 0;
  pointer-events: none;
}

.list-meta {
  color: var(--el-text-color-primary);
  font-size: 14px;
  white-space: nowrap;
}

.list-scroll,
.content-scroll {
  height: 100%;
}

.start-view {
  min-height: 100vh;
  padding: 24vh 20px 40px;
  box-sizing: border-box;
}

.start-lookup {
  width: 100%;
  margin: 0 auto 22px;
  display: grid;
  grid-template-columns: minmax(0, 430px);
  gap: 14px;
  align-items: start;
  justify-content: center;
}

.start-lookup .lookup-control {
  grid-column: 1;
}

.back-button {
  position: fixed;
  top: 16px;
  left: 16px;
  z-index: 20;
  width: 36px;
  height: 36px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
}

.back-button:hover {
  color: var(--el-color-primary);
  border-color: var(--el-color-primary);
}

.mobile-tools-button,
.mobile-tools-overlay {
  display: none;
}

.mobile-actions-group {
  display: none;
}

.result-meta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin-bottom: 10px;

  .icon {
    cursor: pointer;
    color: var(--el-text-color-primary);
  }

  .disabled {
    cursor: not-allowed;
    opacity: 0.35;
  }
}

.auto-refresh-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  color: var(--el-color-success);
  position: relative;
}

.auto-refresh-track {
  position: absolute;
  inset: 1px;
  border-radius: 50%;
  border: 1px solid currentColor;
  box-sizing: border-box;
  opacity: 0.34;
}

.auto-refresh-sector {
  --refresh-progress: 0deg;
  position: absolute;
  inset: 1px;
  border-radius: 50%;
  background: conic-gradient(from 0deg, transparent var(--refresh-progress), currentColor 0);
  box-shadow: inset 0 0 0 1px rgb(34 197 94 / 12%);
}

.auto-refresh-icon.active .auto-refresh-sector {
  animation: auto-refresh-fill var(--refresh-duration) linear 1 both;
}

.auto-refresh-icon:not(.active) .auto-refresh-sector {
  background: none;
  box-shadow: inset 0 0 0 1px rgb(34 197 94 / 18%);
}

.auto-refresh-icon.loading .auto-refresh-track {
  opacity: 0.42;
  border-color: rgb(34 197 94 / 36%);
}

.auto-refresh-icon.loading .auto-refresh-sector {
  inset: 2px;
  background: none;
  border: 1.5px solid rgb(34 197 94 / 22%);
  border-top-color: currentColor;
  border-right-color: currentColor;
  box-shadow: none;
  animation: auto-refresh-spin 0.8s linear infinite;
}

@property --refresh-progress {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}

@keyframes auto-refresh-fill {
  from {
    --refresh-progress: 0deg;
  }
  to {
    --refresh-progress: 360deg;
  }
}

@keyframes auto-refresh-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.result-address {
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--el-text-color-primary);
  cursor: pointer;
  font: inherit;
  padding: 2px 10px;
  max-width: min(520px, 70vw);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;

  &:hover {
    color: var(--el-color-primary);
  }
}

.history-panel {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 9px 10px;
  min-height: 42px;
  background: var(--el-bg-color);
}

.history-floating {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 20;
  width: min(240px, calc(100vw - 32px));
  box-shadow: 0 8px 24px rgb(0 0 0 / 8%);
}

.history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin-bottom: 6px;
}

.history-list {
  display: grid;
  gap: 4px;
  max-height: min(280px, calc(100vh - 140px));
  overflow-y: auto;
  padding-right: 4px;
}

.history-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 22px;
  align-items: center;
  gap: 4px;
}

.history-item {
  border: 0;
  background: transparent;
  color: var(--el-text-color-primary);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  line-height: 22px;
  text-align: left;
  padding: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;

  &:hover {
    color: var(--el-color-primary);
  }
}

.history-remove {
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;

  &:hover {
    color: var(--el-color-danger);
    background: var(--el-fill-color-light);
  }
}

.history-empty {
  color: var(--el-text-color-placeholder);
  font-size: 13px;
  line-height: 22px;
}

.email-row {
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--el-text-color-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 40px;
  padding: 5px 0;
  box-shadow: var(--header-actions-border);
  transition: background 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
  text-align: left;

  &:hover,
  &.active {
    background-color: var(--email-hover-background);
  }
}

.row-title {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: 172px minmax(0, 1fr);
  padding-left: 12px;
}

.email-sender {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  min-width: 0;
  font-size: 12px;

  .name {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
}

.phone-time {
  display: none;
  color: var(--el-text-color-secondary);
  font-size: 11px;
  white-space: nowrap;
}

.email-text {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  min-width: 0;
  font-size: 12px;

  .email-subject {
    display: flex;
    align-items: center;
    gap: 4px;
    overflow: hidden;
    white-space: nowrap;
    min-width: 0;
    padding-left: 5px;
  }

  .subject-text {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .email-content {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    padding-left: 10px;
    color: var(--email-scroll-content-color);
  }
}

.code-tag {
  flex: 0 0 auto;
  max-width: 140px;
  height: 18px;
  line-height: 18px;
  font-size: 12px;
  color: var(--el-text-color-primary);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.email-right {
  text-align: right;
  font-size: 11px;
  white-space: nowrap;
  display: flex;
  padding-left: 12px;
  padding-right: 12px;
  color: var(--el-text-color-primary);
}

.load-more,
.empty-state,
.loading-state {
  padding: 18px;
}

.scope-hint {
  margin: 6px 18px 0;
  padding: 10px 0 2px;
  border-top: 1px dashed var(--el-border-color-lighter);
  color: var(--el-color-danger);
  font-weight: 600;
  font-size: 12px;
  line-height: 1.4;
  text-align: center;
}

.detail-pane {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
}

.detail-actions {
  grid-template-columns: auto minmax(0, 1fr) auto;
}

.detail-action-title {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 14px;
}

.back-icon {
  visibility: hidden;
}

.detail-empty {
  align-self: center;
}

.content-scroll :deep(.el-scrollbar__view) {
  min-height: 100%;
}

.detail-container {
  font-size: 14px;
  padding: 10px 20px 18px;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 180px);
  max-height: calc(100vh - 180px);
  min-height: 0;
  flex: 1 1 auto;
  overflow: hidden;

  .email-title {
    font-size: 20px;
    font-weight: bold;
    margin-bottom: 10px;
    word-break: break-word;
  }
}

.detail-head {
  flex: 0 0 auto;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--light-border-color);
}

.dialog-header {
  display: grid;
  gap: 4px;
}

.dialog-title {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.4;
}

.dialog-subtitle {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

:global(.public-inbox-dialog) {
  max-width: calc(100vw - 24px);
  height: calc(100vh - 48px);
  max-height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
}

:global(.public-inbox-dialog .el-dialog__body) {
  padding-top: 8px;
  overflow: hidden;
  max-height: calc(100vh - 150px);
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

:global(.public-inbox-dialog .el-dialog__header) {
  flex: 0 0 auto;
  padding-right: 44px;
}

.content {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.email-info {
  .send,
  .receive {
    display: flex;
    margin-bottom: 6px;
  }

  .send-name {
    color: var(--regular-text-color);
    display: flex;
    flex-wrap: wrap;
  }

  .send-name-title {
    padding-right: 5px;
  }

  .receive-email {
    color: var(--regular-text-color);
    max-width: 700px;
    word-break: break-word;
  }

  .send-source,
  .source {
    white-space: nowrap;
    font-weight: bold;
    padding-right: 10px;
  }
}

.detail-scroll {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
}

.detail-body-loading {
  min-height: 240px;
  padding-top: 8px;
}

.html-scrollbar {
  width: 100%;
}

.detail-scroll :deep(.el-scrollbar__wrap) {
  overflow-x: hidden;
}

.att {
  margin-top: 30px;
  margin-bottom: 30px;
  border: 1px solid var(--light-border-color);
  padding: 14px;
  border-radius: 6px;
  width: fit-content;
}

.att-title {
  display: flex;
  justify-content: space-between;
  gap: 30px;
  margin-bottom: 8px;

  span:first-child {
    font-weight: bold;
  }
}

.att-box {
  min-width: min(410px, calc(100vw - 60px));
  max-width: 600px;
  display: grid;
  gap: 12px;
}

.att-item {
  color: var(--el-text-color-primary);
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  background: var(--light-ill);
  padding: 5px 7px;
  border-radius: 4px;
  text-decoration: none;
}

.att-item span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shadow-html::after {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--message-block-color);
  pointer-events: none;
}

.email-plain-text {
  font-family: inherit;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

.bottom-distance {
  margin-bottom: 30px;
}

@media (max-width: 820px) {
  .public-page {
    padding-left: 12px;
    padding-right: 12px;
  }

  .search-area {
    padding-top: 12px;
  }

  .back-button {
    display: none;
  }

  .mobile-actions-group {
    width: 72px;
    height: 36px;
    border: 1px solid var(--el-border-color);
    border-radius: 6px;
    background: var(--el-bg-color);
    display: inline-flex;
    align-items: stretch;
    overflow: hidden;
  }

  .mobile-action-button {
    flex: 1 1 0;
    border: 0;
    background: transparent;
    color: var(--el-text-color-primary);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
  }

  .mobile-action-button + .mobile-action-button {
    border-left: 1px solid var(--el-border-color);
  }

  .mobile-action-button:hover,
  .mobile-action-button:active {
    color: var(--el-color-primary);
    background: rgb(64 158 255 / 8%);
  }

  .mobile-action-button:disabled {
    cursor: not-allowed;
    opacity: 0.35;
    background: transparent;
  }

  .mobile-tools-button,
  .random-email-button {
    display: none;
  }

  .mobile-tools-overlay {
    position: fixed;
    inset: 0;
    z-index: 18;
    display: block;
    background: rgb(0 0 0 / 18%);
  }

  .start-lookup {
    grid-template-columns: 1fr;
  }

  .start-lookup .lookup-control,
  .start-lookup .history-panel {
    grid-column: auto;
  }

  .lookup-control {
    grid-template-columns: 72px minmax(0, 1fr) auto;
    gap: 6px;
  }

  .mail-shell {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr;
  }

  .list-pane {
    box-shadow: none;
    display: grid;
  }

  .detail-pane {
    display: none;
  }

  .public-inbox.has-selected {
    .list-pane {
      display: none;
    }

    .detail-pane {
      display: grid;
    }
  }

  .back-icon {
    visibility: visible;
  }

  .list-actions {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .lookup-control {
    grid-template-columns: 72px minmax(0, 1fr) auto;
  }

  .history-floating {
    top: 56px;
    left: 10px;
    right: auto;
    z-index: 22;
    width: min(280px, calc(100vw - 20px));
    max-height: calc(100vh - 70px);
    overflow: auto;
    opacity: 0;
    pointer-events: none;
    transform: translateY(-8px);
    transition: opacity 0.16s ease, transform 0.16s ease;
  }

  .history-floating.mobile-tools-open {
    opacity: 1;
    pointer-events: auto;
    transform: translateY(0);
  }

  .list-meta {
    display: none;
  }

  .row-title {
    grid-template-columns: 1fr;
    gap: 4px;
    padding-right: 12px;
  }

  .email-row {
    min-height: 70px;
  }

  .email-sender {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .phone-time {
    display: inline;
  }

  .email-text {
    grid-template-columns: 1fr;

    .email-subject {
      padding-left: 0;
    }

    .email-content {
      padding-left: 0;
    }
  }

  .email-right {
    display: none;
  }

  .detail-container {
    padding-left: 15px;
    padding-right: 15px;
  }
}
</style>

<style lang="scss">
.public-inbox-dialog {
  max-width: calc(100vw - 24px);
  height: calc(100vh - 48px);
  max-height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
}

.public-inbox-dialog .el-dialog__body {
  padding-top: 8px;
  overflow: hidden;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.public-inbox-dialog .el-dialog__header {
  flex: 0 0 auto;
  padding-right: 44px;
}
</style>
