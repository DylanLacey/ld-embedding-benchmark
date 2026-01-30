<script lang="ts">
type Level = { id: number; code: string; name: string };
type GrammarPoint = {
	id?: number;
	slug?: string;
	japanese?: string;
	romaji?: string;
	meaning?: string;
	levelId?: number | null;
	category?: string | null;
	formation?: string | null;
};

interface Props {
	point?: GrammarPoint;
	levels: Level[];
	action?: string;
}

let { point = {}, levels, action = "?/save" }: Props = $props();
</script>

<form method="POST" {action} class="space-y-4 max-w-2xl">
  <div class="form-control">
    <label class="label" for="slug">
      <span class="label-text">Slug</span>
    </label>
    <input
      type="text"
      id="slug"
      name="slug"
      value={point.slug ?? ''}
      required
      class="input input-bordered"
    />
  </div>

  <div class="form-control">
    <label class="label" for="japanese">
      <span class="label-text">Japanese</span>
    </label>
    <input
      type="text"
      id="japanese"
      name="japanese"
      value={point.japanese ?? ''}
      required
      class="input input-bordered"
    />
  </div>

  <div class="form-control">
    <label class="label" for="romaji">
      <span class="label-text">Romaji</span>
    </label>
    <input
      type="text"
      id="romaji"
      name="romaji"
      value={point.romaji ?? ''}
      class="input input-bordered"
    />
  </div>

  <div class="form-control">
    <label class="label" for="meaning">
      <span class="label-text">Meaning</span>
    </label>
    <input
      type="text"
      id="meaning"
      name="meaning"
      value={point.meaning ?? ''}
      required
      class="input input-bordered"
    />
  </div>

  <div class="form-control">
    <label class="label" for="levelId">
      <span class="label-text">Level</span>
    </label>
    <select id="levelId" name="levelId" class="select select-bordered">
      <option value="">-- Select Level --</option>
      {#each levels as level (level.id)}
        <option value={level.id} selected={point.levelId === level.id}>
          {level.name}
        </option>
      {/each}
    </select>
  </div>

  <div class="form-control">
    <label class="label" for="category">
      <span class="label-text">Category</span>
    </label>
    <input
      type="text"
      id="category"
      name="category"
      value={point.category ?? ''}
      class="input input-bordered"
    />
  </div>

  <div class="form-control">
    <label class="label" for="formation">
      <span class="label-text">Formation</span>
    </label>
    <textarea
      id="formation"
      name="formation"
      class="textarea textarea-bordered"
      rows="3"
    >{point.formation ?? ''}</textarea>
  </div>

  <div class="flex gap-4">
    <button type="submit" class="btn btn-primary">Save</button>
    <a href="/grammar" class="btn btn-ghost">Cancel</a>
  </div>
</form>
