<template>
	<MkStickyContainer>
		<template #header>
			<MkPageHeader :display-back-button="true" />
		</template>
		<MkSpacer :content-max="600">
			<div ref="rootEl" :class="$style.root">
				<!-- #region 送信後 -->
				<div v-if="submittedId" :class="$style.done">
					<i class="ph-check-circle ph-bold" :class="$style.doneIcon"></i>
					<div :class="$style.doneTitle">申請しました</div>
					<p :class="$style.cap">
						管理者が確認します。<br />結果は通知でお知らせします。
					</p>
					<MkButton primary full @click="router.push('/emoji-requests')">申請の一覧へ</MkButton>
					<MkButton full :class="$style.mt8" @click="restart()">続けて申請する</MkButton>
				</div>
				<!-- #endregion -->

				<template v-else>
					<!-- 進み具合 -->
					<div :class="$style.bars">
						<span
							v-for="(s, i) in steps"
							:key="s"
							:class="[$style.bar, { [$style.barDone]: i <= stepIndex }]"
						></span>
					</div>
					<div v-if="resubmitRequest" :class="$style.bars">
						<span v-for="s in steps" :key="s" :class="$style.dotCell">
							<i v-if="stepHasSuggestion(s)" :class="$style.dot"></i>
						</span>
					</div>
					<div :class="$style.stepHead">
						<span>{{ STEP_LABELS[step] }}</span>
						<span :class="$style.counter">{{ stepIndex + 1 }}/{{ steps.length }}</span>
					</div>

					<MkInfo v-if="resubmitRequest?.reviewComment" warn :class="$style.mb12">
						<div :class="$style.commentTitle">管理者からのコメント</div>
						<div :class="$style.pre">{{ resubmitRequest.reviewComment }}</div>
					</MkInfo>
					<MkInfo v-if="restoredDraft && step === 'image'" :class="$style.mb12">
						前回の入力の続きから始めます。
						<button class="_textButton" @click="restart()">最初からやり直す</button>
					</MkInfo>

					<!-- #region 1. 画像 -->
					<section v-if="step === 'image'">
						<div v-if="megamojiSimple" :class="$style.from">
							<i class="ph-sparkle ph-bold"></i> MEGAMOJI で作った画像を{{ d.file ? "受け取りました" : "待っています…" }}
						</div>
						<div data-field="file" :class="fieldClass('file')">
							<div v-if="uploading" :class="$style.cap">画像を受け取っています…</div>
							<MkEmojiImageCheck
								v-else-if="d.file"
								:file="d.file"
								:original-file="d.originalFile"
								@processed="onProcessed"
								@restore="onRestore"
								@reselect="chooseFile"
								@analyzed="onAnalyzed"
							/>
							<template v-else>
								<MkButton primary full large @click="chooseFile">
									<i class="ph-upload-simple ph-bold"></i> 画像を選ぶ
								</MkButton>
								<p :class="$style.cap">
									縦 256px 程度・四隅の余白は削るのがおすすめ。<br />ダーク・ライトの両方で見やすいか確認してください。
								</p>
							</template>
							<div v-if="missingField === 'file'" :class="$style.missingText">画像を選んでください</div>
						</div>
						<div v-if="suggestionOf('file')" :class="$style.proposalImage">
							<img v-if="resubmitRequest?.proposalFileUrl" :src="resubmitRequest.proposalFileUrl" alt="" />
							<MkEmojiRequestSuggestion v-bind="suggestionOf('file')!" @apply="applySuggestion('file')" />
						</div>
					</section>
					<!-- #endregion -->

					<!-- #region 2. 名前とタグ -->
					<section v-else-if="step === 'name'">
						<div data-field="name" :class="fieldClass('name')">
							<div :class="$style.lb"><i class="ph-at ph-bold"></i> 絵文字名 <span :class="$style.req">必須</span></div>
							<MkInput v-model="d.name" :class="$style.mono" />
							<div v-if="d.name && !nameValid" :class="[$style.cap, $style.errorText]">
								小文字の a-z・0-9・_ だけが使えます。
							</div>
							<div v-else-if="nameExists" :class="[$style.cap, $style.warnText]">
								同じ名前の絵文字がすでにあります。<br />このまま申請できますが、承認のときに名前を変えることがあります。
							</div>
							<div v-else :class="$style.cap">
								<template v-if="megamojiSimple">MEGAMOJI のファイル名から入れました。<br /></template>
								小文字の a-z・0-9・_ が使えます。<br />:: は不要です。
							</div>
							<div v-if="missingField === 'name'" :class="$style.missingText">絵文字名を入力してください</div>
							<MkEmojiRequestSuggestion v-if="suggestionOf('name')" v-bind="suggestionOf('name')!" @apply="applySuggestion('name')" />
						</div>
						<div :class="$style.field">
							<div :class="$style.lb"><i class="ph-text-aa ph-bold"></i> 表示名 <span :class="$style.opt">任意</span></div>
							<MkInput v-model="d.alternateName" />
							<div :class="$style.cap">絵文字名を日本語などで書いたもの。</div>
							<MkEmojiRequestSuggestion v-if="suggestionOf('alternateName')" v-bind="suggestionOf('alternateName')!" @apply="applySuggestion('alternateName')" />
						</div>
						<div :class="$style.field">
							<div :class="$style.lb"><i class="ph-text-t ph-bold"></i> 読み <span :class="$style.opt">任意</span></div>
							<MkInput v-model="d.ruby" />
							<div :class="$style.cap">ひらがなで書いた読み方。<br />絵文字の検索にも使われます</div>
							<MkEmojiRequestSuggestion v-if="suggestionOf('ruby')" v-bind="suggestionOf('ruby')!" @apply="applySuggestion('ruby')" />
						</div>
						<div :class="$style.field">
							<div :class="$style.lb"><i class="ph-file-text ph-bold"></i> 説明 <span :class="$style.opt">任意</span></div>
							<MkTextarea v-model="d.description" />
							<div :class="$style.cap">絵文字に関しての説明です。</div>
							<MkEmojiRequestSuggestion v-if="suggestionOf('description')" v-bind="suggestionOf('description')!" @apply="applySuggestion('description')" />
						</div>
						<div :class="$style.field">
							<div :class="$style.lb"><i class="ph-folder ph-bold"></i> カテゴリ <span :class="$style.opt">任意</span></div>
							<MkInput v-model="d.category" :datalist="categories" />
							<div v-if="!d.category.trim()" :class="$style.cap">今あるカテゴリが候補に出ます</div>
							<div v-else-if="categoryCount > 0" :class="[$style.cap, $style.okText]">
								<i class="ph-check ph-bold"></i> 現在 {{ categoryCount }} 件の絵文字があるカテゴリです
							</div>
							<div v-else :class="[$style.cap, $style.warnText]">
								<i class="ph-folder-plus ph-bold"></i> そのカテゴリはまだ存在しません。<br />新規作成する予定です。
							</div>
							<MkEmojiRequestSuggestion v-if="suggestionOf('category')" v-bind="suggestionOf('category')!" @apply="applySuggestion('category')" />
						</div>
						<div :class="$style.field">
							<div :class="$style.lb"><i class="ph-tag ph-bold"></i> タグ・エイリアス <span :class="$style.opt">任意</span></div>
							<MkEmojiTagInput v-model="d.aliases" />
							<div :class="$style.cap">絵文字の別名になります。<br />空白で区切って複数入力できます。</div>
							<MkEmojiRequestSuggestion v-if="suggestionOf('aliases')" v-bind="suggestionOf('aliases')!" @apply="applySuggestion('aliases')" />
						</div>
						<div :class="$style.toggleRow">
							<div>
								<div>センシティブ</div>
								<div :class="$style.cap">公開投稿で使えないような場合</div>
							</div>
							<MkSwitch v-model="d.sensitive" />
						</div>
						<MkEmojiRequestSuggestion v-if="suggestionOf('sensitive')" v-bind="suggestionOf('sensitive')!" @apply="applySuggestion('sensitive')" />
					</section>
					<!-- #endregion -->

					<!-- #region 3. ライセンス情報を入力するか -->
					<section v-else-if="step === 'licenseQ'">
						<div data-field="licenseMode" :class="fieldClass('licenseMode')">
							<div :class="$style.question">ライセンス情報を入力しますか？ <span :class="$style.req">必須</span></div>
							<div :class="$style.cap">可能ならば、分かる項目だけでも入力してください。</div>
							<button
								class="_button"
								:class="[$style.pick, { [$style.pickOn]: d.licenseMode === 'textOnly' }]"
								@click="d.licenseMode = 'textOnly'"
							>
								<i class="ph-text-aa ph-bold"></i> 文字だけの絵文字なので不要（PD）
							</button>
							<button
								class="_button"
								:class="[$style.pick, { [$style.pickOn]: d.licenseMode === 'input' }]"
								@click="d.licenseMode = 'input'"
							>
								<i class="ph-pencil-simple ph-bold"></i> 入力する
							</button>
							<div v-if="missingField === 'licenseMode'" :class="$style.missingText">どちらかを選んでください</div>
							<MkEmojiRequestSuggestion v-if="suggestionOf('licenseMode')" v-bind="suggestionOf('licenseMode')!" @apply="applySuggestion('licenseMode')" />
						</div>
					</section>
					<!-- #endregion -->

					<!-- #region 4. モチーフ -->
					<section v-else-if="step === 'motif'">
						<div data-field="motifSelf" :class="fieldClass('motifSelf')">
							<div :class="$style.question">
								<i class="ph-user-focus ph-bold"></i> この絵文字は、あなた自身がモチーフですか？ <span :class="$style.req">必須</span>
							</div>
							<div :class="$style.cap">
								あなたのアイコンやキャラクターを元にした絵文字なら「はい」。はいにすると、この絵文字を使える人をあなたが決められます（あとから絵文字の詳細ページでも変えられます）。
							</div>
							<div :class="$style.yesNo">
								<button class="_button" :class="[$style.yn, { [$style.pickOn]: d.motifSelf === true }]" @click="d.motifSelf = true">はい</button>
								<button class="_button" :class="[$style.yn, { [$style.pickOn]: d.motifSelf === false }]" @click="d.motifSelf = false">いいえ</button>
							</div>
							<div v-if="missingField === 'motifSelf'" :class="$style.missingText">はい・いいえのどちらかを選んでください</div>
							<MkEmojiRequestSuggestion v-if="suggestionOf('motifSelf')" v-bind="suggestionOf('motifSelf')!" @apply="applySuggestion('motifSelf')" />
						</div>
						<div v-if="d.motifSelf === true" :class="$style.field">
							<div :class="$style.lb">この絵文字を使える人 <span :class="$style.req">必須</span></div>
							<button
								v-for="m in MOTIF_MODES"
								:key="m.value"
								class="_button"
								:class="[$style.mode, { [$style.pickOn]: d.motifUserMode === m.value }]"
								@click="d.motifUserMode = m.value"
							>
								<span :class="[$style.radio, { [$style.radioOn]: d.motifUserMode === m.value }]"></span>
								<span>
									<span>{{ m.label }}</span>
									<span :class="[$style.cap, $style.block]">{{ m.caption }}</span>
								</span>
							</button>
							<MkEmojiRequestSuggestion v-if="suggestionOf('motifUserMode')" v-bind="suggestionOf('motifUserMode')!" @apply="applySuggestion('motifUserMode')" />
						</div>
					</section>
					<!-- #endregion -->

					<!-- #region 5. ライセンス情報 -->
					<section v-else-if="step === 'license'">
						<button class="_button" :class="$style.easy" @click="openPresetSheet">
							<i class="ph-magic-wand ph-bold" :class="$style.easyIcon"></i>
							<span>
								<span :class="$style.easyTitle">どう使ってほしいかで選ぶ</span><br />
								<span :class="$style.easySub">ライセンスがよく分からなくても、<br />下の 2 つをまとめて設定できます</span>
							</span>
							<i class="ph-caret-right ph-bold" :class="$style.easyArrow"></i>
						</button>
						<div v-if="chosenPreset" :class="$style.chosen">
							<i class="ph-check ph-bold" :class="$style.okText"></i>
							「{{ chosenPreset.title }}」{{ d.presetAsk ? "＋「一声かけてほしい」" : "" }}で設定しました
							<div v-if="chosenPreset.note" :class="$style.cap">{{ chosenPreset.note }}</div>
						</div>

						<div :class="$style.field">
							<div :class="$style.lb"><i class="ph-copy ph-bold"></i> 他サーバーへのコピー可否 <span :class="$style.req">必須</span></div>
							<MkSelect :model-value="d.copyPermission" @update:model-value="onCopyPermissionInput">
								<option v-for="o in EMOJI_COPY_PERMISSION_REQUEST_OPTIONS" :key="o.value" :value="o.value">
									{{ o.label }}
								</option>
							</MkSelect>
							<div :class="$style.cap">作者が自分ならば必ず設定してください。<br />必ず守られるわけではありません。</div>
							<MkEmojiRequestSuggestion v-if="suggestionOf('copyPermission')" v-bind="suggestionOf('copyPermission')!" @apply="applySuggestion('copyPermission')" />
						</div>

						<div :class="$style.field">
							<div :class="$style.lb"><i class="ph-certificate ph-bold"></i> ライセンス <span :class="$style.req">必須</span></div>
							<MkSelect :model-value="d.licenseSelect" @update:model-value="onLicenseInput">
								<option value="">{{ EMOJI_LICENSE_NONE_LABEL }}</option>
								<option v-for="n in EMOJI_LICENSE_NAMES" :key="n" :value="n">{{ n }}</option>
								<option :value="EMOJI_LICENSE_OTHER">{{ EMOJI_LICENSE_OTHER_LABEL }}</option>
							</MkSelect>
							<div :class="[$style.cap, $style.pre]">{{ EMOJI_LICENSE_SHORT_DESCRIPTIONS[d.licenseSelect] }}</div>
							<MkEmojiRequestSuggestion v-if="suggestionOf('licenseSelect')" v-bind="suggestionOf('licenseSelect')!" @apply="applySuggestion('licenseSelect')" />
						</div>
						<div v-if="d.licenseSelect === EMOJI_LICENSE_OTHER" data-field="licenseOther" :class="fieldClass('licenseOther')">
							<MkInput v-model="d.licenseOther" placeholder="ライセンス名（例：Apache License 2.0）" />
							<div v-if="missingField === 'licenseOther'" :class="$style.missingText">ライセンス名を入力してください</div>
						</div>

						<div :class="$style.field">
							<div :class="$style.lb"><i class="ph-user ph-bold"></i> 作者 <span :class="$style.opt">任意</span></div>
							<div :class="$style.withMe">
								<MkInput v-model="d.creator" placeholder="@user@host" :class="$style.grow" />
								<button class="_button" :class="$style.me" @click="d.creator = selfId">
									<i class="ph-user-check ph-bold"></i> 自分
								</button>
							</div>
							<div :class="$style.cap">この絵文字を描いた（作った）人です。<br />fediverse 上の ID であることが望ましいです。</div>
							<MkEmojiRequestSuggestion v-if="suggestionOf('creator')" v-bind="suggestionOf('creator')!" @apply="applySuggestion('creator')" />
						</div>

						<div v-if="isAsk" data-field="askContact" :class="fieldClass('askContact')">
							<div :class="$style.lb"><i class="ph-chat-circle-dots ph-bold"></i> 許可を取る連絡先 <span :class="$style.req">必須</span></div>
							<div :class="$style.withMe">
								<MkInput v-model="d.askContact" placeholder="@user@host" :class="$style.grow" />
								<button class="_button" :class="$style.me" @click="d.askContact = selfId">
									<i class="ph-user-check ph-bold"></i> 自分
								</button>
							</div>
							<div :class="$style.cap">保存するときに「{{ ASK_BEFORE_COPY_PREFIX }}」が先頭に付きます</div>
							<div v-if="missingField === 'askContact'" :class="$style.missingText">許可を取る連絡先を入力してください（［自分］で入ります）</div>
							<MkEmojiRequestSuggestion v-if="suggestionOf('askContact')" v-bind="suggestionOf('askContact')!" @apply="applySuggestion('askContact')" />
						</div>

						<div v-if="showUsageInfo" data-field="usageInfo" :class="fieldClass('usageInfo')">
							<div :class="$style.lb">
								<i class="ph-info ph-bold"></i> 使用情報
								<span :class="usageInfoRequired ? $style.req : $style.opt">{{ usageInfoRequired ? "必須" : "任意" }}</span>
							</div>
							<MkTextarea v-model="d.usageInfo" placeholder="使うときの注意など" />
							<div :class="$style.cap">絵文字をインポートする際の注意など。<br />「条件付きでコピー可」のときは必ず入力してください。</div>
							<div v-if="missingField === 'usageInfo'" :class="$style.missingText">使用情報を入力してください</div>
							<MkEmojiRequestSuggestion v-if="suggestionOf('usageInfo')" v-bind="suggestionOf('usageInfo')!" @apply="applySuggestion('usageInfo')" />
						</div>

						<!-- 詳細情報（どれも任意） -->
						<div :class="$style.fold">
							<button class="_button" :class="$style.foldHead" @click="showDetails = !showDetails">
								<i :class="showDetails ? 'ph-caret-down ph-bold' : 'ph-caret-right ph-bold'"></i>
								詳細情報 <span :class="$style.opt">任意</span>
							</button>
							<div v-if="showDetails" :class="$style.foldBody">
								<div :class="$style.hint">設定しなくても申請に問題はありませんが、<br />設定可能な項目です。</div>
								<div :class="$style.field">
									<div :class="$style.lb"><i class="ph-copyright ph-bold"></i> 著作権の表示 <span :class="$style.opt">任意</span></div>
									<MkInput v-model="d.copyrightNotice" />
									<div :class="$style.cap">作者とは別に、元作品の権利者などを示したいときに書きます。<br />例：「© 〇〇株式会社」</div>
									<MkEmojiRequestSuggestion v-if="suggestionOf('copyrightNotice')" v-bind="suggestionOf('copyrightNotice')!" @apply="applySuggestion('copyrightNotice')" />
								</div>
								<div :class="$style.field">
									<div :class="$style.lb"><i class="ph-paint-brush ph-bold"></i> クレジット <span :class="$style.opt">任意</span></div>
									<MkInput v-model="d.creditText" />
									<div :class="$style.cap">作成に使ったソフトやフォントなど。<br />例：「〇〇フォントを使用」「Adobe Illustrator で作成」「Generated using MEGAMOJI」</div>
									<MkEmojiRequestSuggestion v-if="suggestionOf('creditText')" v-bind="suggestionOf('creditText')!" @apply="applySuggestion('creditText')" />
								</div>
								<div :class="$style.field">
									<div :class="$style.lb"><i class="ph-link ph-bold"></i> 関連リンク <span :class="$style.opt">任意</span></div>
									<MkTextarea v-model="d.relatedLinks" placeholder="https://" />
									<div :class="$style.cap">1 行に 1 つずつ入力します。<br />例：絵文字の配布ページ、利用規約のページ、使ったフォントのページ</div>
									<MkEmojiRequestSuggestion v-if="suggestionOf('relatedLinks')" v-bind="suggestionOf('relatedLinks')!" @apply="applySuggestion('relatedLinks')" />
								</div>
							</div>
						</div>
					</section>
					<!-- #endregion -->

					<!-- #region 6. 確認 -->
					<section v-else-if="step === 'confirm'">
						<div :class="$style.cap">この内容で申請します。<br />直したいところがあれば「戻る」で戻れます。</div>
						<div v-if="d.file" :class="$style.confirmImage">
							<img :src="d.file.url" alt="" />
						</div>

						<div :class="$style.sec">絵文字</div>
						<div v-for="row in nameRows" :key="row.label" :class="$style.row">
							<span :class="$style.rowLabel">{{ row.label }}</span>
							<span :class="$style.rowValue">{{ row.value }}</span>
						</div>

						<template v-if="isTextOnly">
							<div :class="$style.sec">ライセンス</div>
							<div :class="$style.row">
								<span :class="$style.rowLabel">ライセンス</span>
								<span :class="$style.rowValue">
									文字だけの絵文字（PD）
									<button v-if="megamojiSimple" class="_button" :class="$style.tiny" @click="leaveMegamojiSimple()">
										文字だけの絵文字ではない場合
									</button>
								</span>
							</div>
						</template>
						<template v-else>
							<div :class="$style.sec">モチーフ</div>
							<div :class="$style.row">
								<span :class="$style.rowLabel">モチーフ</span>
								<span :class="$style.rowValue">{{ motifText }}</span>
							</div>
							<div :class="$style.sec">ライセンス</div>
							<div v-for="row in licenseRows" :key="row.label" :class="$style.row">
								<span :class="$style.rowLabel">{{ row.label }}</span>
								<span :class="$style.rowValue">{{ row.value }}</span>
							</div>
						</template>

						<div :class="[$style.lb, $style.messageLabel]">
							申請にあたって、承認者へ伝える必要があるメッセージ <span :class="$style.opt">任意</span>
						</div>
						<MkTextarea v-model="d.message" placeholder="特に何もなければ空欄で結構です" />
					</section>
					<!-- #endregion -->

					<!-- 進む・戻る -->
					<div :class="$style.nav">
						<MkButton v-if="stepIndex > 0" :class="$style.backButton" @click="back()">戻る</MkButton>
						<MkButton
							v-if="step !== 'confirm'"
							primary
							:class="$style.nextButton"
							:disabled="uploading"
							@click="next()"
						>
							次へ
						</MkButton>
						<MkButton
							v-else
							primary
							:class="$style.nextButton"
							:disabled="submitting"
							@click="submit()"
						>
							{{ resubmitRequest ? "再申請する" : "申請する" }}
						</MkButton>
					</div>
				</template>
			</div>
		</MkSpacer>
	</MkStickyContainer>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * 絵文字の追加申請ページ（`/emoji-requests/new`）。1 つの絵文字を、ステップ式で申請する。
 *
 * @remarks
 * Google フォームの流れを引き継ぎ、スマホで 1 画面に 1 つのテーマだけを置く（計画書「申請画面の案」）。
 * 1. 画像 → 2. 名前とタグ → 3. ライセンス情報を入力するか → 4. モチーフ → 5. ライセンス情報 → 6. 確認
 * - 3 で「文字だけの絵文字なので不要（PD）」なら 4 と 5 を飛ばす
 * - MEGAMOJI から来たとき（`?from=megamoji`）は文字だけの絵文字として「画像 → 名前とタグ → 確認」の 3 ステップにする（H4）。
 *   確認画面の「文字だけの絵文字ではない場合」で 3 から始まるふつうの流れに戻す（H5）
 * - MEGAMOJI が `window.open` でこのページを開いたときは、準備ができたら opener へ知らせ、`postMessage` で画像を受け取る（H1）。
 *   受け付けるのは {@link MEGAMOJI_ORIGIN} からの画像のデータだけ。受け取っても自動では申請しない
 * - 入力の途中は localStorage に下書きとして残し、次に開いたときに続きから始める（MEGAMOJI から来たときは使わない）
 * - 「許可の後、コピー可」は画面だけの選択肢。送るときは連絡先（askContact）を付け、サーバー側で conditional と前置きの文に変える（B5）
 * - 修正のお願いに応えるとき（`?resubmit={id}`）は、元の申請内容を入れた状態で開き、管理者の提案を入力欄の下に出す（R2）。
 *   提案は、入力欄が空か元のままのときだけ押して入れられる。管理者のコメントは各画面の上に、提案のある画面は進み具合の線の下に点で示す。
 *   このときは下書きを使わず、送ると emoji-add-request/resubmit で出し直して、その申請の詳細ページへ移る
 *
 * @internal
 */
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, reactive, ref, useCssModule, watch } from "vue";
import * as Misskey from "calckey-js";
import MkButton from "@/components/MkButton.vue";
import MkInfo from "@/components/MkInfo.vue";
import MkInput from "@/components/form/input.vue";
import MkTextarea from "@/components/form/textarea.vue";
import MkSelect from "@/components/form/select.vue";
import MkSwitch from "@/components/form/switch.vue";
import MkEmojiImageCheck from "@/components/emoji-request/MkEmojiImageCheck.vue";
import MkEmojiRequestSuggestion from "@/components/emoji-request/MkEmojiRequestSuggestion.vue";
import MkEmojiTagInput from "@/components/emoji-request/MkEmojiTagInput.vue";
import * as os from "@/os";
import { $i } from "@/account";
import { host } from "@/config";
import { useRouter } from "@/router";
import { defaultStore } from "@/store";
import { instance, emojiCategories, emojiMap } from "@/instance";
import { selectFile } from "@/scripts/select-file";
import { uploadFile } from "@/scripts/upload";
import { definePageMetadata } from "@/scripts/page-metadata";
import {
	ASK_BEFORE_COPY_PREFIX,
	COPY_PERMISSION_ASK,
	EMOJI_COPY_PERMISSION_REQUEST_OPTIONS,
	EMOJI_LICENSE_NAMES,
	EMOJI_LICENSE_NONE_LABEL,
	EMOJI_LICENSE_OTHER,
	EMOJI_LICENSE_OTHER_LABEL,
	EMOJI_LICENSE_PRESETS,
	EMOJI_LICENSE_SHORT_DESCRIPTIONS,
	MKCK_USAGE_INFO,
	resolveLicenseSelectValue,
	type EmojiLicensePreset,
} from "@/scripts/emoji-license";
import {
	formatEmojiAddRequestField,
	toCopyPermissionChoice,
	type EmojiAddRequestFields,
	type PackedEmojiAddRequest,
} from "@/scripts/emoji-request";

const props = defineProps<{
	/** 絵文字名の初期値（MEGAMOJI などから URL で渡す） */
	name?: string;
	/** "megamoji" なら MEGAMOJI から来た */
	from?: string;
	/** 修正のお願いに応えて直す申請の ID（R2） */
	resubmit?: string;
}>();

const router = useRouter();

/** スクリプト側でも CSS モジュールのクラス名を使う（必須の印のクラスなど） */
const $style = useCssModule();

// #region 定数

/** MEGAMOJI の送り元。これ以外からの postMessage は受け取らない */
const MEGAMOJI_ORIGIN = "https://emtkmkk.github.io";

/** 下書きを置く localStorage のキー */
const DRAFT_KEY = "emojiAddRequestDraft";

/** 画面の種類 */
type Step = "image" | "name" | "licenseQ" | "motif" | "license" | "confirm";

const STEP_LABELS: Record<Step, string> = {
	image: "画像",
	name: "名前とタグ",
	licenseQ: "ライセンス",
	motif: "モチーフ",
	license: "ライセンス情報",
	confirm: "確認",
};

/** モチーフが自分のときの、使える人の選択肢（motifUserMode） */
const MOTIF_MODES = [
	{ value: "any", label: "誰でも使える", caption: "ほかの絵文字と同じように、誰でも使えます" },
	{ value: "follow", label: "フォロー限定", caption: "あなたをフォローしている人だけが使えます" },
	{ value: "owner", label: "自分限定", caption: "あなただけが使えます" },
] as const;

// #endregion

// #region 入力の状態

/** 入力の中身（下書きとしてそのまま保存する） */
type Draft = {
	file: Misskey.entities.DriveFile | null;
	/** 余白カット・縮小をする前の画像（加工していなければ null） */
	originalFile: Misskey.entities.DriveFile | null;
	originalSize: { width: number; height: number } | null;
	name: string;
	alternateName: string;
	ruby: string;
	description: string;
	category: string;
	aliases: string;
	sensitive: boolean;
	/** 3 の答え。未回答は null */
	licenseMode: "input" | "textOnly" | null;
	motifSelf: boolean | null;
	motifUserMode: "any" | "follow" | "owner";
	/** コピー可否（画面の選択肢。"ask" は「許可の後、コピー可」） */
	copyPermission: string;
	licenseSelect: string;
	licenseOther: string;
	creator: string;
	askContact: string;
	usageInfo: string;
	copyrightNotice: string;
	creditText: string;
	relatedLinks: string;
	message: string;
	/** ［どう使ってほしいかで選ぶ］で最後に選んだカード */
	presetKey: string | null;
	presetAsk: boolean;
};

/**
 * 空の入力を作る。
 *
 * @returns 初期状態
 */
function emptyDraft(): Draft {
	return {
		file: null,
		originalFile: null,
		originalSize: null,
		name: "",
		alternateName: "",
		ruby: "",
		description: "",
		category: "",
		aliases: "",
		sensitive: false,
		licenseMode: null,
		motifSelf: null,
		motifUserMode: "any",
		copyPermission: "none",
		licenseSelect: "",
		licenseOther: "",
		creator: "",
		askContact: "",
		usageInfo: "",
		copyrightNotice: "",
		creditText: "",
		relatedLinks: "",
		message: "",
		presetKey: null,
		presetAsk: false,
	};
}

const d = reactive<Draft>(emptyDraft());
const step = ref<Step>("image");
/** MEGAMOJI から来て、3 ステップの流れにしているか */
const megamojiSimple = ref(false);
const restoredDraft = ref(false);
const uploading = ref(false);
const submitting = ref(false);
const submittedId = ref<string | null>(null);
const showDetails = ref(false);
const rootEl = ref<HTMLElement>();

// #endregion

// #region 画面の流れ

const isTextOnly = computed(() => megamojiSimple.value || d.licenseMode === "textOnly");

/** 今の入力で通る画面の一覧 */
const steps = computed<Step[]>(() => {
	if (megamojiSimple.value) return ["image", "name", "confirm"];
	if (d.licenseMode === "textOnly") return ["image", "name", "licenseQ", "confirm"];
	return ["image", "name", "licenseQ", "motif", "license", "confirm"];
});
const stepIndex = computed(() => Math.max(0, steps.value.indexOf(step.value)));

/** 必須なのに入っていない項目（「次へ」を押したときに印を付けた項目。直ったら消える） */
const missingField = ref<string | null>(null);

/**
 * 今の画面で、必須なのに入っていない最初の項目を返す（画面の上から順）。
 *
 * @returns 項目の名前（data-field の値）。無ければ null
 */
function findMissing(): string | null {
	switch (step.value) {
		case "image":
			return d.file == null ? "file" : null;
		case "name":
			return nameValid.value ? null : "name";
		case "licenseQ":
			return d.licenseMode == null ? "licenseMode" : null;
		case "motif":
			return d.motifSelf == null ? "motifSelf" : null;
		case "license":
			if (d.licenseSelect === EMOJI_LICENSE_OTHER && !d.licenseOther.trim()) return "licenseOther";
			if (isAsk.value && !d.askContact.trim()) return "askContact";
			if (usageInfoRequired.value && !d.usageInfo.trim()) return "usageInfo";
			return null;
		default:
			return null;
	}
}

// 印を付けた項目が入力されたら、印を消す
watch(
	() => findMissing(),
	(m) => {
		if (missingField.value != null && m !== missingField.value) missingField.value = null;
	},
);

/**
 * 項目を囲む要素のクラス（印が付いていれば目立たせる）。
 *
 * @param f - 項目の名前
 * @returns クラス
 */
function fieldClass(f: string) {
	return [$style.field, { [$style.missing]: missingField.value === f }];
}

/**
 * 画面を移る。移ったら画面の先頭へ戻す（スマホで下のほうに居たままにならないように）。
 *
 * @remarks
 * ブラウザの履歴にも 1 つ積む。これで、ページ上部の戻るボタン（history.back）やスマホの戻る操作で、
 * 申請ページを抜けずに 1 つ前の画面へ戻れる（{@link onPopState}）。
 * 履歴にはページの key も入れる。別のページへ移ってから戻ってきたときに、ルーターがこのページを開き直せるようにするため。
 *
 * @param s - 移る先
 * @param push - 履歴に積むか（戻る操作で移るときは積まない）
 */
function goTo(s: Step, push = true): void {
	if (s === step.value) return;
	step.value = s;
	missingField.value = null;
	if (push) window.history.pushState({ ...(pageKey ? { key: pageKey } : {}), emojiRequestStep: s }, "", location.href);
	rootEl.value?.scrollIntoView({ block: "start" });
}

/** 次の画面へ。必須の項目が空なら、その項目に印を付けてそこまでスクロールする */
function next(): void {
	const m = findMissing();
	if (m) {
		missingField.value = m;
		rootEl.value?.querySelector(`[data-field="${m}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
		return;
	}
	const i = stepIndex.value;
	if (i < steps.value.length - 1) goTo(steps.value[i + 1]);
}

/** 前の画面へ（ブラウザの戻ると同じ動きにする） */
function back(): void {
	window.history.back();
}

/** このページを開いたときの履歴の key（ルーターが付けたもの） */
let pageKey: string | undefined;

/**
 * ブラウザの戻る・進むで、履歴に入れた画面へ移る。
 *
 * @param ev - popstate
 */
function onPopState(ev: PopStateEvent): void {
	if (ev.state?.key !== pageKey) return;
	const s = ev.state?.emojiRequestStep as Step | undefined;
	goTo(s && steps.value.includes(s) ? s : steps.value[0], false);
}

/** MEGAMOJI の 3 ステップをやめて、「ライセンス情報を入力しますか？」からのふつうの流れに戻す（H5） */
function leaveMegamojiSimple(): void {
	megamojiSimple.value = false;
	d.licenseMode = null;
	goTo("licenseQ");
}

// #endregion

// #region 画像

/**
 * ファイル名から絵文字名の候補を作る（使えない文字は _ にする）。
 *
 * @param fileName - ファイル名
 * @returns 絵文字名の候補（作れなければ空文字）
 */
function nameFromFileName(fileName: string): string {
	return fileName
		.replace(/\.\w+$/, "")
		.toLowerCase()
		.replace(/[^a-z0-9_]+/g, "_")
		.replace(/^_+|_+$/g, "");
}

/**
 * 新しい画像を使う（加工前の情報は消す）。
 *
 * @param file - 選んだ画像
 */
function setFile(file: Misskey.entities.DriveFile): void {
	d.file = file;
	d.originalFile = null;
	d.originalSize = null;
	if (!d.name) d.name = nameFromFileName(file.name);
}

/**
 * 画像を選ぶ。
 *
 * @param ev - 押したボタンのイベント（選び方のメニューの位置に使う）
 */
function chooseFile(ev: MouseEvent): void {
	selectFile(ev.currentTarget ?? ev.target, null, false, true, "emoji", { force: true }).then((file) => {
		if (!file.type.startsWith("image/")) {
			os.alert({ type: "error", text: "画像のファイルを選んでください。" });
			return;
		}
		setFile(file);
	});
}

/** 余白カット・縮小をした（最初の画像は元として残す） */
function onProcessed(v: { file: Misskey.entities.DriveFile; original: { width: number; height: number } }): void {
	if (d.originalFile == null) d.originalFile = d.file;
	d.originalSize = v.original;
	d.file = v.file;
}

/** 画像の確認部品が調べた今の画像のサイズ（確認画面に出す） */
const imageSize = ref<{ width: number; height: number } | null>(null);

function onAnalyzed(v: { width: number; height: number } | null): void {
	imageSize.value = v ? { width: v.width, height: v.height } : null;
}

/** 加工をやめて元の画像に戻す */
function onRestore(): void {
	if (d.originalFile == null) return;
	d.file = d.originalFile;
	d.originalFile = null;
	d.originalSize = null;
}

// #endregion

// #region 名前とタグ

const nameValid = computed(() => /^[a-z0-9_]+$/.test(d.name.trim().toLowerCase()) && d.name.trim().length <= 128);
const nameExists = computed(() => emojiMap.value.has(d.name.trim().toLowerCase()));
const categories = computed(() => emojiCategories.value as string[]);
const categoryCount = computed(() => {
	const c = d.category.trim();
	return (instance.emojis ?? []).filter((e) => e.category === c).length;
});

// #endregion

// #region ライセンス情報

/** 作者・連絡先の［自分］で入れる ID */
const selfId = $i ? `@${$i.username}@${host}` : "";

const isAsk = computed(() => d.copyPermission === COPY_PERMISSION_ASK);

/**
 * 使用情報の欄を出すか。
 *
 * @remarks
 * 「許可の後、コピー可」のときは連絡先の欄に置き換わる（フォームと同じ）。
 * 例外として、もこチキのカード＋「一声かけてほしい」のときだけは連絡先と両方を出す（B5）。
 */
const showUsageInfo = computed(() => !isAsk.value || (d.presetKey === "mkck" && d.presetAsk));
const usageInfoRequired = computed(() => d.copyPermission === "conditional");

/** ［どう使ってほしいかで選ぶ］で選んだカード（手で変えたら消える） */
const chosenPreset = computed(() => EMOJI_LICENSE_PRESETS.find((p) => p.key === d.presetKey) ?? null);

/**
 * コピー可否を手で変えた。カードで決めた内容から外れるので、選んだカードの表示を消す。
 *
 * @param v - 選んだ値
 */
function onCopyPermissionInput(v: string): void {
	d.copyPermission = v;
	d.presetKey = null;
	d.presetAsk = false;
	if (v === COPY_PERMISSION_ASK && !d.askContact) d.askContact = selfId;
}

/**
 * ライセンスを手で変えた。選んだカードの表示を消す。
 *
 * @param v - 選んだ値
 */
function onLicenseInput(v: string): void {
	d.licenseSelect = v;
	d.presetKey = null;
}

/** ［どう使ってほしいかで選ぶ］のパネルを開く */
function openPresetSheet(): void {
	os.popup(
		defineAsyncComponent(() => import("@/components/emoji-request/MkEmojiLicensePresetSheet.vue")),
		{ initialKey: d.presetKey, initialAsk: d.presetAsk },
		{
			done: (v: { preset: EmojiLicensePreset; ask: boolean }) => applyPreset(v.preset, v.ask),
		},
		"closed",
	);
}

/**
 * カードの内容を入れる（入れた後は手で変えられる）。
 *
 * @param preset - 選んだカード
 * @param ask - 「一声かけてほしい」
 */
function applyPreset(preset: EmojiLicensePreset, ask: boolean): void {
	d.presetKey = preset.key;
	d.presetAsk = ask;
	d.copyPermission = ask ? COPY_PERMISSION_ASK : preset.copyPermission;
	d.licenseSelect = resolveLicenseSelectValue(preset.licenseName);
	d.licenseOther = d.licenseSelect === EMOJI_LICENSE_OTHER ? preset.licenseName : "";
	if (preset.usageInfo) {
		d.usageInfo = preset.usageInfo;
	} else if (d.usageInfo === MKCK_USAGE_INFO) {
		// 前にもこチキのカードで入った文は、別のカードに変えたら消す（自分で書いた文は残す）
		d.usageInfo = "";
	}
	if (ask && !d.askContact) d.askContact = selfId;
}

// #endregion

// #region 確認画面

/** コピー可否の値から表示名を引く */
function copyPermissionLabel(v: string): string {
	return EMOJI_COPY_PERMISSION_REQUEST_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

/** 送るライセンス名（付けないなら null） */
const licenseName = computed(() => {
	if (d.licenseSelect === EMOJI_LICENSE_OTHER) return d.licenseOther.trim() || null;
	return d.licenseSelect || null;
});

/** 1 行 1 つの関連リンク */
const relatedLinkList = computed(() => d.relatedLinks.split(/\r?\n/).map((x) => x.trim()).filter(Boolean));

/**
 * 空の行を除いて並べる。
 *
 * @param rows - 見出しと値
 * @returns 値のある行だけ
 */
function filled(rows: { label: string; value: string | null | undefined }[]): { label: string; value: string }[] {
	return rows.filter((r): r is { label: string; value: string } => r.value != null && r.value.trim() !== "");
}

/** 確認画面の「画像」の行（サイズと、加工したときは元のサイズ） */
const imageRowText = computed(() => {
	const props = d.file?.properties as { width?: number; height?: number } | undefined;
	const size = imageSize.value ?? (props?.width && props?.height ? { width: props.width, height: props.height } : null);
	if (size == null) return null;
	const f = (n: number) => n.toLocaleString();
	const base = `${f(size.width)} × ${f(size.height)}`;
	return d.originalFile && d.originalSize
		? `${base}（加工済み。元: ${f(d.originalSize.width)} × ${f(d.originalSize.height)}）`
		: base;
});

const nameRows = computed(() =>
	filled([
		{ label: "絵文字名", value: `:${d.name.trim().toLowerCase()}:` },
		{ label: "表示名", value: d.alternateName },
		{ label: "読み", value: d.ruby },
		{ label: "説明", value: d.description },
		{ label: "カテゴリ", value: d.category },
		{ label: "タグ", value: d.aliases.split(/[\s　]+/).filter(Boolean).join("、") },
		{ label: "センシティブ", value: d.sensitive ? "はい" : "いいえ" },
		{ label: "画像", value: imageRowText.value },
	]),
);

/** 確認画面の「モチーフ」の行 */
const motifText = computed(() => {
	if (d.motifSelf == null) return "（未回答）";
	if (!d.motifSelf) return "いいえ";
	return `自分（${MOTIF_MODES.find((m) => m.value === d.motifUserMode)?.label ?? ""}）`;
});

/** 確認画面の「使用情報」の行。保存される形（連絡先の前置きを付けた形）で見せる */
const usageInfoPreview = computed(() => {
	if (!isAsk.value) return d.usageInfo;
	const head = `${ASK_BEFORE_COPY_PREFIX}${d.askContact.trim() || "（未入力）"}`;
	return showUsageInfo.value && d.usageInfo.trim() ? `${head}\n${d.usageInfo}` : head;
});

const licenseRows = computed(() =>
	filled([
		{ label: "コピー可否", value: copyPermissionLabel(d.copyPermission) },
		{ label: "ライセンス", value: licenseName.value ?? EMOJI_LICENSE_NONE_LABEL },
		{ label: "作者", value: d.creator },
		{ label: "使用情報", value: usageInfoPreview.value },
		{ label: "著作権の表示", value: d.copyrightNotice },
		{ label: "クレジット", value: d.creditText },
		{ label: "関連リンク", value: relatedLinkList.value.join("\n") },
	]),
);

// #endregion

// #region 再申請（修正のお願いへの応答）

/** 再申請する申請（`?resubmit={id}` で開いたとき。それ以外は null） */
const resubmitRequest = ref<PackedEmojiAddRequest | null>(null);

/** 開いたときの入力（提案を押して入れてよいか＝元のままかの判断に使う。書き換えない） */
let originalDraft: Draft | null = null;

/** 提案を出す場所（入力の項目名。画像だけは "file"） */
type Anchor = keyof Draft | "file";

/** 提案を出す場所が、どの画面にあるか（進み具合の線の下の点に使う） */
const ANCHOR_STEP: Readonly<Record<string, Step>> = {
	file: "image",
	name: "name",
	alternateName: "name",
	ruby: "name",
	description: "name",
	category: "name",
	aliases: "name",
	sensitive: "name",
	licenseMode: "licenseQ",
	motifSelf: "motif",
	motifUserMode: "motif",
	copyPermission: "license",
	licenseSelect: "license",
	creator: "license",
	askContact: "license",
	usageInfo: "license",
	copyrightNotice: "license",
	creditText: "license",
	relatedLinks: "license",
};

/**
 * API の画像の情報を、画像の確認部品に渡せる形にする。
 *
 * @remarks
 * 申請の画像はサーバー側（持ち主なし）のファイルなので、ドライブのファイルそのものではない。
 * 部品が使う id・url・name・type・properties だけをそろえる。
 *
 * @param f - 画像の id と URL など
 * @param name - ファイル名に使う絵文字名
 * @returns ドライブのファイルに見立てたもの
 */
function asDriveFile(
	f: { id: string; url: string; type?: string; width?: number | null; height?: number | null },
	name: string,
): Misskey.entities.DriveFile {
	return {
		id: f.id,
		url: f.url,
		thumbnailUrl: f.url,
		name: `${name || "emoji"}.png`,
		type: f.type ?? "image/png",
		properties: { width: f.width ?? undefined, height: f.height ?? undefined },
	} as unknown as Misskey.entities.DriveFile;
}

/**
 * 申請の項目の値を、入力の形に直す（渡された項目のうち、そのまま対応するものだけ）。
 *
 * @param f - 申請の項目（一部でもよい）
 * @returns 入力の値
 */
function fieldsToDraft(f: Partial<EmojiAddRequestFields>): Partial<Draft> {
	const out: Partial<Draft> = {};
	const textKeys = [
		"name",
		"alternateName",
		"ruby",
		"description",
		"category",
		"creator",
		"askContact",
		"usageInfo",
		"copyrightNotice",
		"creditText",
	] as const;
	for (const k of textKeys) if (k in f) out[k] = (f[k] as string | null) ?? "";
	if (f.aliases !== undefined) out.aliases = (f.aliases ?? []).join(" ");
	if (f.relatedLinks !== undefined) out.relatedLinks = (f.relatedLinks ?? []).join("\n");
	if (f.sensitive !== undefined) out.sensitive = f.sensitive;
	if (f.motifSelf !== undefined) out.motifSelf = f.motifSelf;
	if (f.motifUserMode !== undefined) out.motifUserMode = f.motifUserMode ?? "any";
	return out;
}

/**
 * 申請の内容から、入力の全体を作る。
 *
 * @param r - 申請
 * @returns 入力
 */
function requestToDraft(r: PackedEmojiAddRequest): Draft {
	const licenseSelect = resolveLicenseSelectValue(r.licenseName);
	return {
		...emptyDraft(),
		...fieldsToDraft(r),
		file: r.file ? asDriveFile(r.file, r.name) : null,
		licenseMode: r.isTextOnly ? "textOnly" : "input",
		copyPermission: toCopyPermissionChoice(r),
		licenseSelect,
		licenseOther: licenseSelect === EMOJI_LICENSE_OTHER ? r.licenseName ?? "" : "",
		message: r.message ?? "",
	};
}

/** 管理者の提案。場所ごとに、見せる文と、押したときに入れる値 */
const suggestions = computed(() => {
	const out: Partial<Record<Anchor, { text: string; patch: Partial<Draft> }>> = {};
	const r = resubmitRequest.value;
	const p = r?.proposal;
	if (r == null || p == null) return out;
	const merged = { ...r, ...p };
	for (const key of Object.keys(p) as Array<keyof EmojiAddRequestFields>) {
		const text = formatEmojiAddRequestField(key, p[key], merged) || "（空にする）";
		switch (key) {
			case "fileId":
				if (r.proposalFileUrl) out.file = { text: "画像を差し替える", patch: {} };
				break;
			case "isTextOnly":
				out.licenseMode = { text, patch: { licenseMode: p.isTextOnly ? "textOnly" : "input" } };
				break;
			case "copyPermission":
				out.copyPermission = { text, patch: { copyPermission: toCopyPermissionChoice(merged) } };
				break;
			case "askContact":
				// 連絡先の有無で「許可の後、コピー可」かどうかが変わるので、コピー可否もいっしょに入れる
				out.askContact = {
					text,
					patch: { askContact: p.askContact ?? "", copyPermission: toCopyPermissionChoice(merged) },
				};
				break;
			case "licenseName": {
				const sel = resolveLicenseSelectValue(p.licenseName);
				out.licenseSelect = {
					text: p.licenseName ?? EMOJI_LICENSE_NONE_LABEL,
					patch: { licenseSelect: sel, licenseOther: sel === EMOJI_LICENSE_OTHER ? p.licenseName ?? "" : "" },
				};
				break;
			}
			default:
				out[key as keyof Draft] = { text, patch: fieldsToDraft({ [key]: p[key] }) };
		}
	}
	return out;
});

/**
 * 提案の表示のしかたを決める（R2）。
 *
 * @remarks
 * - 入力が提案と同じなら「入れました」
 * - 入力が空か、開いたときのままなら、押して入れられる
 * - この画面で書き換えた後は、ただの文として出す（書き直したものを上書きしないため）
 *
 * @param a - 提案を出す場所
 * @returns 表示に渡す値（提案が無ければ null）
 */
function suggestionOf(a: Anchor): { text: string; state: "apply" | "applied" | "plain" } | null {
	const s = suggestions.value[a];
	if (s == null || originalDraft == null) return null;
	if (a === "file") {
		const proposedId = resubmitRequest.value?.proposal?.fileId;
		const state = d.file?.id === proposedId ? "applied" : d.file?.id === originalDraft.file?.id ? "apply" : "plain";
		return { text: s.text, state };
	}
	const keys = Object.keys(s.patch) as Array<keyof Draft>;
	if (keys.every((k) => d[k] === s.patch[k])) return { text: s.text, state: "applied" };
	const untouched = keys.every((k) => d[k] === originalDraft![k] || d[k] === "" || d[k] == null);
	return { text: s.text, state: untouched ? "apply" : "plain" };
}

/**
 * 提案の値を入力に入れる（入れてよいときだけ）。
 *
 * @param a - 提案を出す場所
 */
function applySuggestion(a: Anchor): void {
	if (suggestionOf(a)?.state !== "apply") return;
	const r = resubmitRequest.value;
	if (a === "file") {
		if (r?.proposal?.fileId && r.proposalFileUrl) {
			d.file = asDriveFile({ id: r.proposal.fileId, url: r.proposalFileUrl }, d.name);
			d.originalFile = null;
			d.originalSize = null;
		}
		return;
	}
	Object.assign(d, suggestions.value[a]!.patch);
}

/**
 * その画面に管理者の提案があるか。
 *
 * @param s - 画面
 * @returns あれば true
 */
function stepHasSuggestion(s: Step): boolean {
	return Object.keys(suggestions.value).some((a) => ANCHOR_STEP[a] === s);
}

/**
 * 再申請する申請を読み込み、入力に入れる。
 *
 * @param id - 申請の ID
 */
async function loadResubmit(id: string): Promise<void> {
	try {
		const r = (await os.api("emoji-add-request/show", { requestId: id })) as PackedEmojiAddRequest;
		if (r.status !== "changesRequested") {
			await os.alert({ type: "info", text: "この申請は、今は修正のお願い中ではありません。" });
			router.replace(`/emoji-requests/add/${id}`);
			return;
		}
		Object.assign(d, requestToDraft(r));
		originalDraft = JSON.parse(JSON.stringify(d));
		resubmitRequest.value = r;
		// 詳細情報の項目に提案があれば、折りたたみを開いておく（見落とさないように）
		const p = r.proposal ?? {};
		if ("copyrightNotice" in p || "creditText" in p || "relatedLinks" in p) showDetails.value = true;
	} catch {
		await os.alert({ type: "error", text: "申請を読み込めませんでした。" });
		router.replace("/emoji-requests");
	}
}

// #endregion

// #region 送信

/** API のエラーの code から、利用者に見せる文 */
const ERROR_MESSAGES: Record<string, string> = {
	NO_SUCH_FILE: "画像が見つかりませんでした。選び直してください。",
	NOT_IMAGE: "画像のファイルを選んでください。",
	COPY_FAILED: "画像の取り込みに失敗しました。時間をおいて試してください。",
	INVALID_NAME: "絵文字名には小文字の a-z・数字・_ だけが使えます。",
	MOTIF_REQUIRED: "「あなた自身がモチーフか」を選んでください。",
	USAGE_INFO_REQUIRED: "「条件付きでコピー可」のときは、使用情報に条件を書いてください。",
};

/**
 * 入力から、API に送る申請の項目を作る（新しい申請と再申請で共通）。
 *
 * @param file - 申請の画像
 * @returns 送る項目
 */
function buildFields(file: Misskey.entities.DriveFile) {
	const textOnly = isTextOnly.value;
	const text = (v: string) => v.trim() || null;
	return {
		fileId: file.id,
		name: d.name.trim().toLowerCase(),
		alternateName: text(d.alternateName),
		ruby: text(d.ruby),
		description: text(d.description),
		category: text(d.category),
		aliases: d.aliases.split(/[\s　]+/).filter(Boolean),
		sensitive: d.sensitive,
		isTextOnly: textOnly,
		// 文字だけの絵文字は、承認時にライセンスが固定値になるので、ライセンス情報の画面の値は送らない
		motifSelf: textOnly ? null : d.motifSelf,
		motifUserMode: !textOnly && d.motifSelf ? d.motifUserMode : null,
		copyPermission: textOnly ? "none" : isAsk.value ? "conditional" : d.copyPermission,
		askContact: !textOnly && isAsk.value ? text(d.askContact) : null,
		licenseName: textOnly ? null : licenseName.value,
		creator: textOnly ? null : text(d.creator),
		usageInfo: !textOnly && showUsageInfo.value ? text(d.usageInfo) : null,
		copyrightNotice: textOnly ? null : text(d.copyrightNotice),
		creditText: textOnly ? null : text(d.creditText),
		relatedLinks: textOnly ? [] : relatedLinkList.value,
		message: text(d.message),
		imageProcessed: d.originalFile != null,
		originalWidth: d.originalFile != null ? d.originalSize?.width ?? null : null,
		originalHeight: d.originalFile != null ? d.originalSize?.height ?? null : null,
	};
}

async function submit(): Promise<void> {
	if (d.file == null || submitting.value) return;
	submitting.value = true;
	try {
		const fields = buildFields(d.file);
		if (resubmitRequest.value) {
			const r = resubmitRequest.value;
			// 画像を変えていなければ、加工の記録は元の申請のまま残す
			const imageChanged = d.file.id !== r.file?.id;
			await os.api("emoji-add-request/resubmit", {
				...fields,
				requestId: r.id,
				imageProcessed: imageChanged ? fields.imageProcessed : undefined,
				originalWidth: imageChanged ? fields.originalWidth : undefined,
				originalHeight: imageChanged ? fields.originalHeight : undefined,
			});
			os.success();
			router.push(`/emoji-requests/add/${r.id}`);
			return;
		}
		const res = await os.api("emoji-add-request/create", {
			...fields,
			source: props.from === "megamoji" ? "megamoji" : "form",
		});
		clearDraft();
		submittedId.value = res.id;
		rootEl.value?.scrollIntoView({ block: "start" });
	} catch (err: any) {
		os.alert({
			type: "error",
			text: ERROR_MESSAGES[err?.code] ?? err?.message ?? "申請に失敗しました。",
		});
	} finally {
		submitting.value = false;
	}
}

/** 入力を消して最初から */
function restart(): void {
	Object.assign(d, emptyDraft());
	clearDraft();
	restoredDraft.value = false;
	submittedId.value = null;
	megamojiSimple.value = false;
	goTo("image");
}

// #endregion

// #region 下書き

// NOTE: localStorage が使えない環境（プライベートモードなど）でも、申請はできるようにする
function saveDraft(): void {
	// 再申請の入力は下書きにしない（新しい申請の下書きを上書きしないため）
	if (megamojiSimple.value || submittedId.value || props.resubmit) return;
	try {
		localStorage.setItem(DRAFT_KEY, JSON.stringify({ draft: d }));
	} catch {}
}

function clearDraft(): void {
	try {
		localStorage.removeItem(DRAFT_KEY);
	} catch {}
}

/**
 * 下書きを読み込む。
 *
 * @returns 読み込めたら true
 */
function loadDraft(): boolean {
	try {
		const raw = localStorage.getItem(DRAFT_KEY);
		if (!raw) return false;
		const saved = JSON.parse(raw) as { draft: Partial<Draft> };
		Object.assign(d, emptyDraft(), saved.draft);
		// NOTE: 画面は最初（画像）から始める。途中の画面から始めると、ブラウザの履歴に前の画面が無く、
		// 戻る操作で申請ページを抜けてしまうため。履歴に画面が残っているときは restoreStepFromHistory で移る
		return true;
	} catch {
		return false;
	}
}

watch([d, step], saveDraft, { deep: true });

// #endregion

// #region MEGAMOJI からの受け取り

/**
 * MEGAMOJI から画像を受け取る。
 *
 * @remarks
 * 送り元が {@link MEGAMOJI_ORIGIN} で、`{ type: "mkkey:emoji-request:image", image: Blob }` の形のものだけを受け付ける。
 * 画像以外のデータ（名前など）は受け取らない（名前は URL で渡してもらう）。受け取った画像は自分のドライブへ上げる。
 *
 * @param ev - 届いたメッセージ
 */
async function onMessage(ev: MessageEvent): Promise<void> {
	if (ev.origin !== MEGAMOJI_ORIGIN) return;
	const data = ev.data as { type?: unknown; image?: unknown } | null;
	if (data?.type !== "mkkey:emoji-request:image" || !(data.image instanceof Blob)) return;
	if (!data.image.type.startsWith("image/")) return;
	uploading.value = true;
	try {
		const ext = data.image.type.split("/")[1]?.replace(/[^a-z0-9]/g, "") || "png";
		const file = await uploadFile(
			new File([data.image], `${d.name || "megamoji"}.${ext}`, { type: data.image.type }),
			defaultStore.state.uploadFolderEmoji ?? defaultStore.state.uploadFolder,
			undefined,
			true,
			true,
			false,
			{ force: true },
		);
		setFile(file);
	} catch (err) {
		os.alert({ type: "error", text: "MEGAMOJI からの画像の受け取りに失敗しました。画像を選び直してください。" });
		console.error(err);
	} finally {
		uploading.value = false;
	}
}

/**
 * ブラウザの履歴に画面が入っていれば、その画面へ移る。
 *
 * @remarks
 * 別のページへ移ってからブラウザの戻るで帰ってきたとき（ルーターがこのページを開き直す）に、元の画面から続けるため。
 */
function restoreStepFromHistory(): void {
	const s = window.history.state?.emojiRequestStep as Step | undefined;
	if (s && steps.value.includes(s)) step.value = s;
}

onMounted(async () => {
	pageKey = window.history.state?.key;
	window.addEventListener("popstate", onPopState);
	if (props.resubmit) {
		await loadResubmit(props.resubmit);
		restoreStepFromHistory();
		return;
	}
	if (props.from === "megamoji") {
		// MEGAMOJI から来たときは下書きを使わず、文字だけの絵文字の 3 ステップにする（H4）
		megamojiSimple.value = true;
		d.licenseMode = "textOnly";
		if (props.name) d.name = nameFromFileName(props.name);
		window.addEventListener("message", onMessage);
		// 開いた MEGAMOJI へ、画像を受け取る準備ができたことを知らせる
		window.opener?.postMessage({ type: "mkkey:emoji-request:ready" }, MEGAMOJI_ORIGIN);
		return;
	}
	restoredDraft.value = loadDraft();
	if (props.name && !d.name) d.name = nameFromFileName(props.name);
	restoreStepFromHistory();
});

onBeforeUnmount(() => {
	window.removeEventListener("message", onMessage);
	window.removeEventListener("popstate", onPopState);
});

// #endregion

definePageMetadata(
	computed(() => ({
		title: props.resubmit ? "直して再申請" : "絵文字を申請",
		icon: "ph-smiley-sticker ph-bold ph-lg",
	})),
);
</script>

<style lang="scss" module>
// NOTE: 見た目は試作（計画書の「申請画面の案」の最終版）に合わせている。色は各自のテーマの変数を使う

.root {
	scroll-margin-top: 80px;
}

// #region 進み具合

.bars {
	display: flex;
	gap: 4px;
}

.bar {
	flex: 1;
	height: 3px;
	border-radius: 2px;
	background: var(--divider);
}

.barDone {
	background: var(--accent);
}

.dotCell {
	flex: 1;
	display: flex;
	justify-content: center;
	height: 8px;
}

.dot {
	width: 6px;
	height: 6px;
	margin: 2px 0 0;
	border-radius: 50%;
	background: var(--accent);
}

.stepHead {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	margin: 10px 0 4px;
	font-weight: bold;
}

.counter {
	font-size: 0.85em;
	font-weight: normal;
	opacity: 0.7;
}

// #endregion

// #region 項目

.field {
	margin: 14px 0 0;
	border-radius: 8px;
	transition: box-shadow 0.2s, background 0.2s;
}

/** 必須なのに入っていない項目（「次へ」を押したとき） */
.missing {
	box-shadow: 0 0 0 2px var(--error);
	background: color-mix(in srgb, var(--error) 8%, transparent);
	padding: 6px;
	margin-left: -6px;
	margin-right: -6px;
}

.missingText {
	margin: 4px 0 0;
	font-size: 0.85em;
	font-weight: bold;
	color: var(--error);
}

.lb {
	display: flex;
	align-items: center;
	gap: 6px;
	margin: 0 0 4px;
	font-size: 0.9em;
	opacity: 0.85;
}

.question {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 6px;
	margin: 6px 0 2px;
	font-weight: bold;
}

.req,
.opt {
	display: inline-block;
	padding: 0 6px;
	border-radius: 6px;
	font-size: 0.75em;
	font-weight: normal;
	line-height: 1.6;
}

.req {
	color: var(--error);
	background: color-mix(in srgb, var(--error) 15%, transparent);
}

.opt {
	border: solid 1px var(--divider);
	opacity: 0.8;
}

.cap {
	margin: 4px 0 0;
	font-size: 0.8em;
	line-height: 1.6;
	opacity: 0.7;
}

.block {
	display: block;
	margin: 2px 0 0;
}

.pre {
	white-space: pre-wrap;
}

.errorText {
	color: var(--error);
	opacity: 1;
}

.warnText {
	color: var(--warn);
	opacity: 1;
}

.okText {
	color: var(--success);
	opacity: 1;
}

.mono input {
	font-family: monospace;
}

.withMe {
	display: flex;
	align-items: center;
	gap: 6px;
}

.grow {
	flex: 1;
	min-width: 0;
}

.me {
	flex: none;
	padding: 6px 10px;
	border-radius: 6px;
	font-size: 0.85em;
	white-space: nowrap;
	color: var(--accent);
	background: var(--accentedBg);
	border: solid 1px var(--accent);
}

.toggleRow {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	margin: 16px 0 0;
	padding: 12px 0 0;
	border-top: solid 1px var(--divider);
}

// #endregion

// #region 選ぶ項目

.pick {
	display: flex;
	align-items: center;
	gap: 6px;
	width: 100%;
	margin: 8px 0 0;
	padding: 12px;
	text-align: left;
	border: solid 1px var(--divider);
	border-radius: 10px;
}

.pickOn {
	border: solid 2px var(--accent);
	padding: 11px;
}

.yesNo {
	display: flex;
	gap: 8px;
	margin: 8px 0 0;
}

.yn {
	flex: 1;
	padding: 10px;
	text-align: center;
	border: solid 1px var(--divider);
	border-radius: 10px;
}

.mode {
	display: flex;
	align-items: flex-start;
	gap: 8px;
	width: 100%;
	margin: 6px 0 0;
	padding: 9px;
	text-align: left;
	border: solid 1px var(--divider);
	border-radius: 8px;

	&.pickOn {
		padding: 8px;
	}
}

.radio {
	flex: none;
	width: 14px;
	height: 14px;
	margin: 3px 0 0;
	border-radius: 50%;
	border: solid 2px var(--divider);
	box-sizing: border-box;
}

.radioOn {
	border: solid 5px var(--accent);
}

// #endregion

// #region ライセンス情報

.easy {
	display: flex;
	align-items: center;
	gap: 10px;
	width: 100%;
	margin: 4px 0 0;
	padding: 10px 12px;
	text-align: left;
	border-radius: 10px;
	border: solid 1px var(--accent);
	background: var(--accentedBg);
	color: var(--accent);
}

.easyIcon {
	font-size: 1.5em;
}

.easyTitle {
	font-weight: bold;
}

.easySub {
	font-size: 0.8em;
	opacity: 0.85;
}

.easyArrow {
	margin-left: auto;
}

.chosen {
	margin: 8px 0 0;
	padding: 6px 10px;
	border-radius: 8px;
	font-size: 0.9em;
	line-height: 1.6;
	background: var(--buttonBg);
}

.fold {
	margin: 16px 0 0;
	border: solid 1px var(--divider);
	border-radius: 8px;
}

.foldHead {
	display: flex;
	align-items: center;
	gap: 6px;
	width: 100%;
	padding: 10px;
	font-size: 0.9em;
}

.foldBody {
	padding: 0 10px 10px;
	border-top: solid 1px var(--divider);
}

.hint {
	margin: 10px 0 0;
	font-size: 0.85em;
	line-height: 1.6;
	opacity: 0.8;
}

// #endregion

// #region 画像・確認

.from {
	display: flex;
	align-items: center;
	gap: 6px;
	margin: 0 0 8px;
	padding: 6px 10px;
	border-radius: 8px;
	font-size: 0.9em;
	background: var(--buttonBg);
}

.proposalImage {
	margin: 12px 0 0;

	> img {
		display: block;
		max-width: 60%;
		max-height: 64px;
		margin: 0 0 8px;
		object-fit: contain;
	}
}

.confirmImage {
	display: flex;
	justify-content: center;
	margin: 10px 0 4px;
	padding: 10px;
	border-radius: 10px;
	background: var(--buttonBg);

	> img {
		max-width: 100%;
		height: 32px;
		object-fit: contain;
	}
}

.sec {
	margin: 14px 0 2px;
	font-size: 0.8em;
	opacity: 0.6;
}

.row {
	display: flex;
	gap: 8px;
	padding: 5px 0;
	font-size: 0.9em;
	line-height: 1.6;
	border-bottom: solid 1px var(--divider);
}

.rowLabel {
	flex: none;
	width: 7em;
	opacity: 0.7;
}

.rowValue {
	min-width: 0;
	white-space: pre-wrap;
	overflow-wrap: anywhere;
}

.tiny {
	display: block;
	margin: 2px 0 0;
	font-size: 0.8em;
	text-decoration: underline;
	opacity: 0.6;
}

.messageLabel {
	margin-top: 16px;
	font-size: 0.8em;
}

.commentTitle {
	font-weight: bold;
	margin: 0 0 4px;
}

// #endregion

// #region 進む・戻る、送信後

.nav {
	display: flex;
	gap: 8px;
	margin: 20px 0 0;
}

.backButton {
	flex: 0 0 76px;
}

.nextButton {
	flex: 1;
}

.done {
	text-align: center;
	padding: 24px 0;
}

.doneIcon {
	font-size: 48px;
	color: var(--success);
}

.doneTitle {
	margin: 8px 0 0;
	font-size: 1.2em;
	font-weight: bold;
}

.mt8 {
	margin-top: 8px;
}

.mb12 {
	margin: 8px 0 12px;
}

// #endregion
</style>
