<template>
	<MkStickyContainer>
		<template #header><MkPageHeader /></template>
		<MkSpacer :content-max="800">
			<div :class="$style.root">
				<div>{{ i18n.ts._mfm.intro }}</div>
				<Mfm
					text="[この下に続く内容は一部古かったり抜けがあります。こちらで最新の構文を含め詳しく解説されています。](https://misskey.io/@hakohako_f2/pages/mfm-cheat-sheet)"
				/>
				<br />
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.mention }}</div>
					<div class="content">
						<p>{{ i18n.ts._mfm.mentionDescription }}</p>
						<div class="preview">
							<Mfm :text="preview_mention" />
							<MkTextarea v-model="preview_mention"
								><template #label>MFM</template></MkTextarea
							>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.hashtag }}</div>
					<div class="content">
						<p>{{ i18n.ts._mfm.hashtagDescription }}</p>
						<div class="preview">
							<Mfm :text="preview_hashtag" />
							<MkTextarea v-model="preview_hashtag"
								><template #label>MFM</template></MkTextarea
							>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.link }}</div>
					<div class="content">
						<p>{{ i18n.ts._mfm.linkDescription }}</p>
						<div class="preview">
							<Mfm :text="preview_link" />
							<MkTextarea v-model="preview_link"
								><template #label>MFM</template></MkTextarea
							>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.emoji }}</div>
					<div class="content">
						<p>{{ i18n.ts._mfm.emojiDescription }}</p>
						<div class="preview">
							<Mfm :text="preview_emoji" />
							<MkTextarea v-model="preview_emoji"
								><template #label>MFM</template></MkTextarea
							>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.bold }} <span :class="$style.badge">{{ i18n.ts._mfm.webOnly }}</span></div>
					<div class="content">
						<p>{{ i18n.ts._mfm.boldDescription }}</p>
						<p :class="$style.syntax">書式: <code>**テキスト**</code> または <code>$[b テキスト]</code>（$[b] は Web限定で bold に展開）</p>
						<div class="preview">
							<Mfm :text="preview_bold" />
							<MkTextarea v-model="preview_bold"
								><template #label>MFM</template></MkTextarea
							>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.small }} <span :class="$style.badge">{{ i18n.ts._mfm.webOnly }}</span></div>
					<div class="content">
						<p>{{ i18n.ts._mfm.smallDescription }}</p>
						<p :class="$style.syntax">書式: <code>&lt;small&gt;テキスト&lt;/small&gt;</code> または <code>$[s テキスト]</code>（$[s] は Web限定）</p>
						<div class="preview">
							<Mfm :text="preview_small" />
							<MkTextarea v-model="preview_small"
								><template #label>MFM</template></MkTextarea
							>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.quote }} <span :class="$style.badge">{{ i18n.ts._mfm.webOnly }}</span></div>
					<div class="content">
						<p>{{ i18n.ts._mfm.quoteDescription }}</p>
						<p :class="$style.syntax">書式: <code>&gt; テキスト</code> または <code>$[q テキスト]</code>（$[q] は Web限定）</p>
						<div class="preview">
							<Mfm :text="preview_quote" />
							<MkTextarea v-model="preview_quote"
								><template #label>MFM</template></MkTextarea
							>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.center }} <span :class="$style.badge">{{ i18n.ts._mfm.webOnly }}</span></div>
					<div class="content">
						<p>{{ i18n.ts._mfm.centerDescription }}</p>
						<p :class="$style.syntax">書式: <code>&lt;center&gt;テキスト&lt;/center&gt;</code> または <code>$[c テキスト]</code>（$[c] は Web限定）</p>
						<div class="preview">
							<Mfm :text="preview_center" />
							<MkTextarea v-model="preview_center"
								><template #label>MFM</template></MkTextarea
							>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.inlineCode }}</div>
					<div class="content">
						<p>{{ i18n.ts._mfm.inlineCodeDescription }}</p>
						<div class="preview">
							<Mfm :text="preview_inlineCode" />
							<MkTextarea v-model="preview_inlineCode"
								><template #label>MFM</template></MkTextarea
							>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.blockCode }}</div>
					<div class="content">
						<p>{{ i18n.ts._mfm.blockCodeDescription }}</p>
						<div class="preview">
							<Mfm :text="preview_blockCode" />
							<MkTextarea v-model="preview_blockCode"
								><template #label>MFM</template></MkTextarea
							>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.inlineMath }}</div>
					<div class="content">
						<p>{{ i18n.ts._mfm.inlineMathDescription }}</p>
						<div class="preview">
							<Mfm :text="preview_inlineMath" />
							<MkTextarea v-model="preview_inlineMath"
								><template #label>MFM</template></MkTextarea
							>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.blockMath }}</div>
					<div class="content">
						<p>{{ i18n.ts._mfm.blockMathDescription }}</p>
						<div class="preview">
							<Mfm :text="preview_blockMath" />
							<MkTextarea v-model="preview_blockMath"
								><template #label>MFM</template></MkTextarea
							>
						</div>
					</div>
				</div>
				<!-- deprecated
		<div class="section _block">
			<div class="title">{{ i18n.ts._mfm.search }}</div>
			<div class="content">
				<p>{{ i18n.ts._mfm.searchDescription }}</p>
				<div class="preview">
					<Mfm :text="preview_search"/>
					<MkTextarea v-model="preview_search"><template #label>MFM</template></MkTextarea>
				</div>
			</div>
		</div>
		-->
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.flip }}</div>
					<div class="content">
						<p>{{ i18n.ts._mfm.flipDescription }}</p>
						<p :class="$style.syntax">書式: <code>$[flip 内容]</code> / <code>$[flip.v 内容]</code> / <code>$[flip.h,v 内容]</code>（オプション: h 横反転, v 縦反転）</p>
						<div class="preview">
							<Mfm :text="preview_flip" />
							<MkTextarea v-model="preview_flip"
								><template #label>MFM</template></MkTextarea
							>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.font }}</div>
					<div class="content">
						<p>{{ i18n.ts._mfm.fontDescription }}</p>
						<p :class="$style.syntax">書式: <code>$[font.serif 内容]</code> など。オプション: serif, monospace, cursive, fantasy, emoji, math（いずれか1つ）</p>
						<div class="preview">
							<Mfm :text="preview_font" />
							<MkTextarea v-model="preview_font"
								><template #label>MFM</template></MkTextarea
							>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.x2 }}</div>
					<div class="content">
						<p>{{ i18n.ts._mfm.x2Description }}</p>
						<div class="preview">
							<Mfm :text="preview_x2" />
							<MkTextarea v-model="preview_x2"
								><template #label>MFM</template></MkTextarea
							>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.x3 }}</div>
					<div class="content">
						<p>{{ i18n.ts._mfm.x3Description }}</p>
						<div class="preview">
							<Mfm :text="preview_x3" />
							<MkTextarea v-model="preview_x3"
								><template #label>MFM</template></MkTextarea
							>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.x4 }}</div>
					<div class="content">
						<p>{{ i18n.ts._mfm.x4Description }}</p>
						<div class="preview">
							<Mfm :text="preview_x4" />
							<MkTextarea v-model="preview_x4"
								><template #label>MFM</template></MkTextarea
							>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.blur }}</div>
					<div class="content">
						<p>{{ i18n.ts._mfm.blurDescription }}</p>
						<div class="preview">
							<Mfm :text="preview_blur" />
							<MkTextarea v-model="preview_blur"
								><template #label>MFM</template></MkTextarea
							>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.jelly }}</div>
					<div class="content">
						<p>{{ i18n.ts._mfm.jellyDescription }}</p>
						<p :class="$style.syntax">書式: <code>$[jelly speed=1s delay=0s loop=infinite 内容]</code></p>
						<div class="preview">
							<Mfm :text="preview_jelly" />
							<MkTextarea v-model="preview_jelly"
								><template #label>MFM</template></MkTextarea
							>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.tada }}</div>
					<div class="content">
						<p>{{ i18n.ts._mfm.tadaDescription }}</p>
						<p :class="$style.syntax">書式: <code>$[tada speed=1s delay=0s loop=infinite 内容]</code></p>
						<div class="preview">
							<Mfm :text="preview_tada" />
							<MkTextarea v-model="preview_tada"
								><template #label>MFM</template></MkTextarea
							>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.jump }}</div>
					<div class="content">
						<p>{{ i18n.ts._mfm.jumpDescription }}</p>
						<p :class="$style.syntax">書式: <code>$[jump speed=0.75s delay=0s loop=infinite 内容]</code></p>
						<div class="preview">
							<Mfm :text="preview_jump" />
							<MkTextarea v-model="preview_jump"
								><template #label>MFM</template></MkTextarea
							>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.bounce }}</div>
					<div class="content">
						<p>{{ i18n.ts._mfm.bounceDescription }}</p>
						<p :class="$style.syntax">書式: <code>$[bounce speed=0.75s delay=0s loop=infinite 内容]</code></p>
						<div class="preview">
							<Mfm :text="preview_bounce" />
							<MkTextarea v-model="preview_bounce"
								><template #label>MFM</template></MkTextarea
							>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.spin }}</div>
					<div class="content">
						<p>{{ i18n.ts._mfm.spinDescription }}</p>
						<p :class="$style.syntax">書式: <code>$[spin 内容]</code> / <code>$[spin.left]</code> / <code>$[spin.x]</code> / <code>$[spin.y]</code>。speed, delay, loop 指定可。</p>
						<div class="preview">
							<Mfm :text="preview_spin" />
							<MkTextarea v-model="preview_spin"
								><template #label>MFM</template></MkTextarea
							>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.shake }}</div>
					<div class="content">
						<p>{{ i18n.ts._mfm.shakeDescription }}</p>
						<p :class="$style.syntax">書式: <code>$[shake speed=0.5s delay=0s loop=infinite 内容]</code></p>
						<div class="preview">
							<Mfm :text="preview_shake" />
							<MkTextarea v-model="preview_shake"
								><template #label>MFM</template></MkTextarea
							>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.twitch }}</div>
					<div class="content">
						<p>{{ i18n.ts._mfm.twitchDescription }}</p>
						<p :class="$style.syntax">書式: <code>$[twitch speed=0.5s delay=0s loop=infinite 内容]</code></p>
						<div class="preview">
							<Mfm :text="preview_twitch" />
							<MkTextarea v-model="preview_twitch"
								><template #label>MFM</template></MkTextarea
							>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.rainbow }}</div>
					<div class="content">
						<p>{{ i18n.ts._mfm.rainbowDescription }}</p>
						<p :class="$style.syntax">書式: <code>$[rainbow speed=2s delay=0s loop=infinite 内容]</code></p>
						<div class="preview">
							<Mfm :text="preview_rainbow" />
							<MkTextarea v-model="preview_rainbow"
								><template #label>MFM</template></MkTextarea
							>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.sparkle }}</div>
					<div class="content">
						<p>{{ i18n.ts._mfm.sparkleDescription }}</p>
						<div class="preview">
							<Mfm :text="preview_sparkle" />
							<MkTextarea v-model="preview_sparkle"
								><span>MFM</span></MkTextarea
							>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.rotate }}</div>
					<div class="content">
						<p>{{ i18n.ts._mfm.rotateDescription }}</p>
						<p :class="$style.syntax">書式: <code>$[rotate deg=90 内容]</code> / <code>$[rotate.x,deg=45 内容]</code> / <code>$[rotate.y,deg=45 内容]</code></p>
						<div class="preview">
							<Mfm :text="preview_rotate" />
							<MkTextarea v-model="preview_rotate"
								><span>MFM</span></MkTextarea
							>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.position }}</div>
					<div class="content">
						<p>{{ i18n.ts._mfm.positionDescription }}</p>
						<p :class="$style.syntax">書式: <code>$[position x=0 y=0 内容]</code>（単位は em）。nocompat を付けると Misskey 互換表示モードを有効にしません。</p>
						<p :class="$style.note">
							<code>$[position nocompat …]</code> のように <code>nocompat</code> オプションを付けると、その投稿では Misskey 互換表示モードを有効にしません（Cluckey の表示のままにします）。
						</p>
						<div class="preview">
							<Mfm :text="preview_position" />
							<MkTextarea v-model="preview_position"
								><span>MFM</span></MkTextarea
							>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.scale }}</div>
					<div class="content">
						<p>{{ i18n.ts._mfm.scaleDescription }}</p>
						<p :class="$style.syntax">書式: <code>$[scale x=1 y=1 内容]</code>（最大5まで）</p>
						<div class="preview">
							<Mfm :text="preview_scale" />
							<MkTextarea v-model="preview_scale"
								><span>MFM</span></MkTextarea
							>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.crop }}</div>
					<div class="content">
						<p>{{ i18n.ts._mfm.cropDescription }}</p>
						<p :class="$style.syntax">書式: <code>$[crop.top=0,right=0,bottom=0,left=0 内容]</code>（%で指定）</p>
						<div class="preview">
							<Mfm :text="preview_crop" />
							<MkTextarea v-model="preview_crop"><template #label>MFM</template></MkTextarea>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.fade }}</div>
					<div class="content">
						<p>{{ i18n.ts._mfm.fadeDescription }}</p>
						<p :class="$style.syntax">書式: <code>$[fade 内容]</code> / <code>$[fade.out 内容]</code>。speed, delay, loop 指定可。</p>
						<div class="preview">
							<Mfm :text="preview_fade" />
							<MkTextarea v-model="preview_fade"><template #label>MFM</template></MkTextarea>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.border }}</div>
					<div class="content">
						<p>{{ i18n.ts._mfm.borderDescription }}</p>
						<p :class="$style.syntax">書式: <code>$[border style=solid,width=1,radius=0,color=accent 内容]</code>。noclip で overflow を維持。</p>
						<div class="preview">
							<Mfm :text="preview_border" />
							<MkTextarea v-model="preview_border"><template #label>MFM</template></MkTextarea>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.ruby }}</div>
					<div class="content">
						<p>{{ i18n.ts._mfm.rubyDescription }}</p>
						<p :class="$style.syntax">書式: <code>$[ruby 漢字 よみ]</code> または <code>$[ruby.rb=漢字,rt=よみ 内容]</code></p>
						<div class="preview">
							<Mfm :text="preview_ruby" />
							<MkTextarea v-model="preview_ruby"><template #label>MFM</template></MkTextarea>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.unixtime }} <span :class="$style.badge">{{ i18n.ts._mfm.webOnly }}</span></div>
					<div class="content">
						<p>{{ i18n.ts._mfm.unixtimeDescription }}</p>
						<p :class="$style.syntax">書式: <code>$[time Unix秒]</code> または <code>$[time 日付文字列]</code>（日付はWeb限定でUnix秒に変換）。countdown でカウントダウン。</p>
						<div class="preview">
							<Mfm :text="preview_unixtime" />
							<MkTextarea v-model="preview_unixtime"><template #label>MFM</template></MkTextarea>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.foreground }}</div>
					<div class="content">
						<p>{{ i18n.ts._mfm.foregroundDescription }}</p>
						<p :class="$style.syntax">書式: <code>$[fg.color=ff0000 内容]</code>（16進3〜6桁）</p>
						<div class="preview">
							<Mfm :text="preview_fg" />
							<MkTextarea v-model="preview_fg"
								><span>MFM</span></MkTextarea
							>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.background }}</div>
					<div class="content">
						<p>{{ i18n.ts._mfm.backgroundDescription }}</p>
						<p :class="$style.syntax">書式: <code>$[bg.color=ff0000 内容]</code>（16進3〜6桁）</p>
						<div class="preview">
							<Mfm :text="preview_bg" />
							<MkTextarea v-model="preview_bg"
								><span>MFM</span></MkTextarea
							>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.plain }} <span :class="$style.badge">{{ i18n.ts._mfm.webOnly }}</span></div>
					<div class="content">
						<p>{{ i18n.ts._mfm.plainDescription }}</p>
						<p :class="$style.syntax">書式: <code>&lt;plain&gt;内容&lt;/plain&gt;</code> または <code>$[p 内容]</code>（$[p] は Web限定）</p>
						<div class="preview">
							<Mfm :text="preview_plain" />
							<MkTextarea v-model="preview_plain"
								><span>MFM</span></MkTextarea
							>
						</div>
					</div>
				</div>
			</div>
		</MkSpacer>
	</MkStickyContainer>
</template>

<script lang="ts" setup>
import { defineComponent } from "vue";
import MkTextarea from "@/components/form/textarea.vue";
import { definePageMetadata } from "@/scripts/page-metadata";
import { i18n } from "@/i18n";
import { instance } from "@/instance";

let preview_mention = $ref("@example");
let preview_hashtag = $ref("#test");
let preview_link = $ref(`[${i18n.ts._mfm.dummy}](https://calckey.org)`);
let preview_emoji = $ref(
	instance.recentlyPopularReactions.length > 1
		? `${
				instance.recentlyPopularReactions.filter(
					(x) => x.name != ":iine_fav:"
				)[0].name
		  }`
		: ":emojiname:"
);
let preview_bold = $ref(`**${i18n.ts._mfm.dummy}**`);
let preview_small = $ref(`<small>${i18n.ts._mfm.dummy}</small>`);
let preview_center = $ref(`<center>${i18n.ts._mfm.dummy}</center>`);
let preview_inlineCode = $ref('`<: "Hello, world!"`');
let preview_blockCode = $ref(
	'```\n~ (#i, 100) {\n\t<: ? ((i % 15) = 0) "FizzBuzz"\n\t\t.? ((i % 3) = 0) "Fizz"\n\t\t.? ((i % 5) = 0) "Buzz"\n\t\t. i\n}\n```'
);
let preview_inlineMath = $ref("\\(x= \\frac{-b' \\pm \\sqrt{(b')^2-ac}}{a}\\)");
let preview_blockMath = $ref("\\[x= \\frac{-b' \\pm \\sqrt{(b')^2-ac}}{a}\\]");
let preview_quote = $ref(`> ${i18n.ts._mfm.dummy}`);
let preview_search = $ref(
	`${i18n.ts._mfm.dummy} [search]\n${i18n.ts._mfm.dummy} [検索]\n${i18n.ts._mfm.dummy} 検索`
);
let preview_jelly = $ref("$[jelly 🍮] $[jelly.speed=5s 🍮]");
let preview_tada = $ref("$[tada 🍮] $[tada.speed=5s 🍮]");
let preview_jump = $ref("$[jump 🍮] $[jump.speed=5s 🍮]");
let preview_bounce = $ref("$[bounce 🍮] $[bounce.speed=5s 🍮]");
let preview_shake = $ref("$[shake 🍮] $[shake.speed=5s 🍮]");
let preview_twitch = $ref("$[twitch 🍮] $[twitch.speed=5s 🍮]");
let preview_spin = $ref(
	"$[spin 🍮] $[spin.left 🍮] $[spin.alternate 🍮]\n$[spin.x 🍮] $[spin.x,left 🍮] $[spin.x,alternate 🍮]\n$[spin.y 🍮] $[spin.y,left 🍮] $[spin.y,alternate 🍮]\n\n$[spin.speed=5s 🍮]"
);
let preview_flip = $ref(
	`$[flip ${i18n.ts._mfm.dummy}]\n$[flip.v ${i18n.ts._mfm.dummy}]\n$[flip.h,v ${i18n.ts._mfm.dummy}]`
);
let preview_font = $ref(
	`$[font.serif ${i18n.ts._mfm.dummy}]\n$[font.monospace ${i18n.ts._mfm.dummy}]\n$[font.cursive ${i18n.ts._mfm.dummy}]\n$[font.fantasy ${i18n.ts._mfm.dummy}]`
);
let preview_x2 = $ref("$[x2 🍮]");
let preview_x3 = $ref("$[x3 🍮]");
let preview_x4 = $ref("$[x4 🍮]");
let preview_blur = $ref(`$[blur ${i18n.ts._mfm.dummy}]`);
let preview_rainbow = $ref("$[rainbow 🍮] $[rainbow.speed=5s 🍮]");
let preview_sparkle = $ref("$[sparkle 🍮]");
let preview_rotate = $ref(
	"$[rotate 🍮]\n$[rotate.deg=45 🍮]\n$[rotate.x,deg=45 Hello, world!]"
);
let preview_position = $ref(
	"$[position.y=-1 Positioning]\n$[position.x=-1 Positioning]\n$[position.y=-0.5 nocompat 互換オフ]",
);
let preview_scale = $ref(
	"$[scale.x=1.3 Scaling]\n$[scale.x=1.3,y=2 Scaling]\n$[scale.y=0.3 Tiny scaling]",
);
let preview_crop = $ref("$[crop.top=10,right=10,bottom=10,left=10 Crop]");
let preview_fade = $ref("$[fade Fade in] $[fade.out Fade out]");
let preview_border = $ref("$[border.color=ff0000,width=2,radius=4 Border]");
let preview_ruby = $ref("$[ruby 漢字 かんじ]");
let preview_unixtime = $ref(
	`$[unixtime ${Math.floor(Date.now() / 1000)}]`,
);
let preview_fg = $ref("$[fg.color=ff0000 Text color]");
let preview_bg = $ref("$[bg.color=ff0000 Background color]");
let preview_plain = $ref(
	"<plain>**bold** @mention #hashtag `code` $[x2 🍮]</plain>"
);

definePageMetadata({
	title: i18n.ts._mfm.cheatSheet,
	icon: "ph-question ph-bold ph-lg",
});
</script>

<style lang="scss" module>
.root {
	background: var(--bg);

	> .section {
		> .title {
			position: sticky;
			z-index: 1;
			top: var(--stickyTop, 0);
			padding: 1rem;
			font-weight: bold;
			-webkit-backdrop-filter: var(--blur, blur(10px));
			backdrop-filter: var(--blur, blur(10px));
			background: var(--X16);
		}

		> .content {
			> p {
				margin: 0;
				padding: 1rem;
			}

			> .syntax {
				margin: 0 1rem 0.5rem;
				padding: 0.5rem 0.75rem;
				font-size: 0.9em;
				background: var(--panel);
				border-radius: 0.25rem;

				code {
					word-break: break-all;
				}
			}

			> .note {
				margin: 0 1rem 0.5rem;
				padding: 0.5rem 0.75rem;
				font-size: 0.9em;
				background: var(--panel);
				border-radius: 0.25rem;
				color: var(--fgTransparentWeak);

				code {
					word-break: break-all;
				}
			}

			> .preview {
				border-top: solid 0.03125rem var(--divider);
				padding: 1rem;
			}
		}
	}
}

.badge {
	display: inline-block;
	margin-left: 0.5rem;
	padding: 0.15rem 0.4rem;
	font-size: 0.7em;
	font-weight: normal;
	vertical-align: middle;
	background: var(--accent);
	color: var(--fgOnAccent);
	border-radius: 0.25rem;
}
</style>
