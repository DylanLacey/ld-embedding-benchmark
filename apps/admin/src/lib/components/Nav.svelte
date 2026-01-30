<script lang="ts">
import { page } from "$app/stores";

const navItems = [
	{ href: "/", label: "Dashboard" },
	{ href: "/grammar", label: "Grammar" },
	{ href: "/queries", label: "Queries" },
	{ href: "/settings/languages", label: "Languages" },
];
</script>

<nav class="navbar bg-base-200">
  <div class="flex-1">
    <a href="/" class="btn btn-ghost text-xl">embedding4ld</a>
  </div>
  <div class="flex-none">
    <ul class="menu menu-horizontal px-1">
      {#each navItems as item (item.href)}
        <li>
          <a
            href={item.href}
            class:active={$page.url.pathname === item.href}
          >
            {item.label}
          </a>
        </li>
      {/each}
    </ul>
  </div>
</nav>
