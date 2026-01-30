<h1 class="text-3xl font-bold mb-6">New Benchmark Query</h1>

<form method="POST" class="space-y-4 max-w-2xl">
	<div class="form-control">
		<label class="label" for="queryText">
			<span class="label-text">Query Text</span>
		</label>
		<textarea
			id="queryText"
			name="queryText"
			required
			class="textarea textarea-bordered"
			rows="3"
		></textarea>
	</div>

	<div class="grid grid-cols-2 gap-4">
		<div class="form-control">
			<label class="label" for="queryLanguage">
				<span class="label-text">Query Language</span>
			</label>
			<input
				type="text"
				id="queryLanguage"
				name="queryLanguage"
				class="input input-bordered"
				placeholder="en"
			/>
		</div>
		<div class="form-control">
			<label class="label" for="targetLanguage">
				<span class="label-text">Target Language</span>
			</label>
			<input
				type="text"
				id="targetLanguage"
				name="targetLanguage"
				class="input input-bordered"
				placeholder="ja"
			/>
		</div>
	</div>

	<div class="form-control">
		<label class="label" for="difficulty">
			<span class="label-text">Difficulty</span>
		</label>
		<select id="difficulty" name="difficulty" class="select select-bordered">
			<option value="">-- Select --</option>
			<option value="direct">Direct</option>
			<option value="descriptive">Descriptive</option>
			<option value="situational">Situational</option>
			<option value="adversarial">Adversarial</option>
		</select>
	</div>

	<div class="form-control">
		<label class="label cursor-pointer justify-start gap-4">
			<input type="checkbox" name="isRanked" class="checkbox" />
			<span class="label-text">Ranked (graded relevance)</span>
		</label>
	</div>

	<div class="flex gap-4">
		<button type="submit" class="btn btn-primary">Create</button>
		<a href="/queries" class="btn btn-ghost">Cancel</a>
	</div>
</form>
