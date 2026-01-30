<script lang="ts">
import "../app.css";
import favicon from "$lib/assets/favicon.svg";
import Nav from "$lib/components/Nav.svelte";

const { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div data-theme="synthwave" class="min-h-screen flex flex-col">
	<Nav />
	<main class="flex-1 container mx-auto p-6">
		{@render children()}
	</main>
</div>
