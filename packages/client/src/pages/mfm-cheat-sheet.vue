<template>
	<MkStickyContainer>
		<template #header><MkPageHeader /></template>
		<MkSpacer :content-max="800">
			<div :class="$style.root">
				<div>{{ i18n.ts._mfm.intro }}</div>
				<Mfm text="[この下に続く内容は一部古かったり抜けがあります。こちらで最新の構文を含め詳しく解説されています。](https://misskey.io/@hakohako_f2/pages/mfm-cheat-sheet)" />
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
					<div class="title">{{ i18n.ts._mfm.bold }}</div>
					<div class="content">
						<p>{{ i18n.ts._mfm.boldDescription }}</p>
						<div class="preview">
							<Mfm :text="preview_bold" />
							<MkTextarea v-model="preview_bold"
								><template #label>MFM</template></MkTextarea
							>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.small }}</div>
					<div class="content">
						<p>{{ i18n.ts._mfm.smallDescription }}</p>
						<div class="preview">
							<Mfm :text="preview_small" />
							<MkTextarea v-model="preview_small"
								><template #label>MFM</template></MkTextarea
							>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.quote }}</div>
					<div class="content">
						<p>{{ i18n.ts._mfm.quoteDescription }}</p>
						<div class="preview">
							<Mfm :text="preview_quote" />
							<MkTextarea v-model="preview_quote"
								><template #label>MFM</template></MkTextarea
							>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.center }}</div>
					<div class="content">
						<p>{{ i18n.ts._mfm.centerDescription }}</p>
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
						<div class="preview">
							<Mfm :text="preview_scale" />
							<MkTextarea v-model="preview_scale"
								><span>MFM</span></MkTextarea
							>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.foreground }}</div>
					<div class="content">
						<p>{{ i18n.ts._mfm.foregroundDescription }}</p>
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
						<div class="preview">
							<Mfm :text="preview_bg" />
							<MkTextarea v-model="preview_bg"
								><span>MFM</span></MkTextarea
							>
						</div>
					</div>
				</div>
				<div class="section _block">
					<div class="title">{{ i18n.ts._mfm.plain }}</div>
					<div class="content">
						<p>{{ i18n.ts._mfm.plainDescription }}</p>
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
	instance.recentlyPopularReactions.length > 1 ? `${instance.recentlyPopularReactions.filter((x) => x.name != ":iine_fav:")[0].name}` : ":emojiname:"
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
	"$[position.y=-1 Positioning]\n$[position.x=-1 Positioning]"
);
let preview_scale = $ref(
	"$[scale.x=1.3 Scaling]\n$[scale.x=1.3,y=2 Scaling]\n$[scale.y=0.3 Tiny scaling]"
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
			top: var(--stickyTop, 0px);
			padding: 16px;
			font-weight: bold;
			-webkit-backdrop-filter: var(--blur, blur(10px));
			backdrop-filter: var(--blur, blur(10px));
			background-color: var(--X16);
		}

		> .content {
			> p {
				margin: 0;
				padding: 16px;
			}

			> .preview {
				border-top: solid 0.5px var(--divider);
				padding: 16px;
			}
		}
	}
}
</style>
