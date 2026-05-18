<script setup lang="ts">
const props = defineProps<{
  room: string
}>()

const { buildInviteUrl, whatsAppShareUrl } = useInviteLink()

const inviteUrl = computed(() => buildInviteUrl(props.room))
const copied = ref(false)

async function copyLink() {
  const url = inviteUrl.value
  if (!url) return
  try {
    await navigator.clipboard.writeText(url)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    // Fallback for older browsers / non-secure contexts
    const input = document.createElement('input')
    input.value = url
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  }
}

function shareWhatsApp() {
  const url = whatsAppShareUrl(props.room)
  if (!url) return
  window.open(url, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <div v-if="inviteUrl" class="invite">
    <p class="invite-label">Invite link — share via WhatsApp</p>
    <div class="invite-row">
      <input
        class="invite-input"
        type="text"
        readonly
        :value="inviteUrl"
        aria-label="Invite link"
        @focus="($event.target as HTMLInputElement).select()"
      />
      <button type="button" class="btn-copy" @click="copyLink">
        {{ copied ? 'Copied!' : 'Copy' }}
      </button>
    </div>
    <button type="button" class="btn-whatsapp" @click="shareWhatsApp">
      Share on WhatsApp
    </button>
  </div>
</template>

<style scoped>
.invite {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}

.invite-label {
  margin: 0 0 0.5rem;
  font-size: 0.85rem;
  color: var(--muted);
}

.invite-row {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.invite-input {
  flex: 1;
  min-width: 0;
  padding: 0.5rem 0.65rem;
  font-size: 0.8rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
}

.btn-copy {
  flex-shrink: 0;
  padding: 0.5rem 0.85rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.85rem;
}

.btn-copy:hover {
  border-color: var(--accent);
}

.btn-whatsapp {
  width: 100%;
  padding: 0.65rem 1rem;
  border: none;
  border-radius: 8px;
  background: #25d366;
  color: #fff;
  font-weight: 600;
  font-size: 0.9rem;
}

.btn-whatsapp:hover {
  filter: brightness(1.05);
}
</style>
