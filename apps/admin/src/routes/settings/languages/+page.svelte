<script lang="ts">
let { data } = $props();
let showAddLanguage = $state(false);
let addLevelFor = $state<number | null>(null);
</script>

<div class="flex justify-between items-center mb-6">
	<h1 class="text-3xl font-bold">Languages & Levels</h1>
	<button class="btn btn-primary" onclick={() => (showAddLanguage = !showAddLanguage)}
		>Add Language</button
	>
</div>

{#if showAddLanguage}
	<form method="POST" action="?/addLanguage" class="card bg-base-200 mb-6">
		<div class="card-body">
			<h2 class="card-title">New Language</h2>
			<div class="grid grid-cols-2 gap-4">
				<div class="form-control">
					<label class="label" for="code"><span class="label-text">Code</span></label>
					<input
						type="text"
						id="code"
						name="code"
						required
						placeholder="ja"
						class="input input-bordered"
					/>
				</div>
				<div class="form-control">
					<label class="label" for="name"><span class="label-text">Name</span></label>
					<input
						type="text"
						id="name"
						name="name"
						required
						placeholder="Japanese"
						class="input input-bordered"
					/>
				</div>
			</div>
			<div class="card-actions mt-4">
				<button type="submit" class="btn btn-primary">Add</button>
				<button type="button" class="btn btn-ghost" onclick={() => (showAddLanguage = false)}
					>Cancel</button
				>
			</div>
		</div>
	</form>
{/if}

<div class="space-y-6">
	{#each data.languages as lang (lang.id)}
		<div class="card bg-base-200">
			<div class="card-body">
				<div class="flex justify-between items-center">
					<h2 class="card-title">
						{lang.name} <span class="badge badge-neutral">{lang.code}</span>
					</h2>
					<button
						class="btn btn-sm btn-secondary"
						onclick={() => (addLevelFor = addLevelFor === lang.id ? null : lang.id)}
						>Add Level</button
					>
				</div>

				{#if addLevelFor === lang.id}
					<form method="POST" action="?/addLevel" class="mt-4 p-4 bg-base-300 rounded-lg">
						<input type="hidden" name="languageId" value={lang.id} />
						<div class="grid grid-cols-3 gap-4">
							<div class="form-control">
								<label class="label" for="level-code-{lang.id}"
									><span class="label-text">Code</span></label
								>
								<input
									type="text"
									id="level-code-{lang.id}"
									name="code"
									required
									placeholder="N5"
									class="input input-bordered input-sm"
								/>
							</div>
							<div class="form-control">
								<label class="label" for="level-name-{lang.id}"
									><span class="label-text">Name</span></label
								>
								<input
									type="text"
									id="level-name-{lang.id}"
									name="name"
									required
									placeholder="JLPT N5"
									class="input input-bordered input-sm"
								/>
							</div>
							<div class="form-control">
								<label class="label" for="level-order-{lang.id}"
									><span class="label-text">Sort Order</span></label
								>
								<input
									type="number"
									id="level-order-{lang.id}"
									name="sortOrder"
									class="input input-bordered input-sm"
								/>
							</div>
						</div>
						<div class="mt-4">
							<button type="submit" class="btn btn-sm btn-primary">Add Level</button>
						</div>
					</form>
				{/if}

				{#if lang.levels.length > 0}
					<div class="overflow-x-auto mt-4">
						<table class="table table-sm">
							<thead>
								<tr>
									<th>Code</th>
									<th>Name</th>
									<th>Order</th>
									<th></th>
								</tr>
							</thead>
							<tbody>
								{#each lang.levels as level (level.id)}
									<tr>
										<td><span class="badge badge-primary">{level.code}</span></td>
										<td>{level.name}</td>
										<td>{level.sortOrder ?? '-'}</td>
										<td>
											<form method="POST" action="?/deleteLevel" class="inline">
												<input type="hidden" name="levelId" value={level.id} />
												<button type="submit" class="btn btn-xs btn-ghost text-error"
													>Delete</button
												>
											</form>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<p class="opacity-50 mt-4">No levels defined</p>
				{/if}
			</div>
		</div>
	{:else}
		<p class="opacity-50 text-center py-8">No languages configured</p>
	{/each}
</div>
