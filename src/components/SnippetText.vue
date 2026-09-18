<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Snippet, Word } from '../types'

const props = defineProps<{
  snippet: Snippet
  word: Word
  mode: 'show' | 'blank'      // blank：目标词挖空（拼写题）
  showEnglish?: boolean       // 非目标句默认显示英文（用户设置）
}>()

const expanded = ref<Set<number>>(new Set())
function toggle(i: number) {
  const s = new Set(expanded.value)
  s.has(i) ? s.delete(i) : s.add(i)
  expanded.value = s
}

function renderTarget(en: string) {
  if (props.mode === 'blank') {
    return en.replace(/\*([^*]+)\*/, (_m, f: string) => `<mark class="blank">${props.word.word[0]}${'_'.repeat(Math.max(2, f.length - 1))}</mark>`)
  }
  return en.replace(/\*([^*]+)\*/, '<mark>$1</mark>')
}

const hasSentences = computed(() => !!props.snippet.sentences?.length)
</script>

<template>
  <div class="snip">
    <template v-if="hasSentences">
      <template v-for="(s, i) in snippet.sentences" :key="i">
        <span v-if="s.target" class="snippet target" v-html="renderTarget(s.en)"></span>
        <span v-else class="cn" :class="{ open: showEnglish || expanded.has(i) }" @click="toggle(i)">
          <span class="cn-text">{{ s.cn }}</span>
          <span v-if="showEnglish || expanded.has(i)" class="en-sub">{{ s.en }}</span>
        </span>
        {{ ' ' }}
      </template>
    </template>
    <p v-else class="snippet" v-html="renderTarget(snippet.en)"></p>
  </div>
</template>

<style scoped>
.snip { font-size: 17px; line-height: 1.85; }
.target { display: inline; font-size: 19px; font-family: Georgia, "Times New Roman", "Songti SC", serif; padding: 2px 4px; border-radius: 6px; background: color-mix(in srgb, var(--accent) 10%, transparent); }
.cn { display: inline; color: var(--fg); cursor: pointer; border-bottom: 1px dotted color-mix(in srgb, var(--fg) 25%, transparent); }
.cn:hover { border-bottom-color: var(--accent); }
.cn.open .cn-text { color: var(--muted); }
.en-sub { display: block; font-size: 14px; color: var(--muted); font-family: Georgia, serif; margin: 2px 0 6px; animation: fadein .25s ease; }
</style>
