<script lang="ts">
  import { isRunningAsPWA } from "./utils/pwaCheck";
  import {onMount} from "svelte";

  interface BeforeInstallPromptEvent extends Event {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  }

  let isPWA = $state(isRunningAsPWA());
  let deferredPrompt = $state<BeforeInstallPromptEvent | null>(null);
  onMount(()=>{
      console.log('onMount');
      window.addEventListener('beforeinstallprompt', (e: Event) => {
          e.preventDefault();
          console.log('beforeinstallprompt fired');
          deferredPrompt = e as BeforeInstallPromptEvent;
          console.log(deferredPrompt);
      });
  })

  async function handleInstall() {
      if (!deferredPrompt) return;

      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
          isPWA = true;
      }
      deferredPrompt = null;
  }

</script>

<svelte:head>

</svelte:head>

{#if isPWA}
    <p>PWA</p>
{:else}
    <div class="lock-screen">
        <h1>Wymagana instalacja aplikacji</h1>
        <p>Ta aplikacja działa wyłącznie jako zainstalowane PWA.</p>

        {#if deferredPrompt}
            <button onclick={handleInstall}>Zainstaluj aplikację</button>
        {:else}
            <p class="ios-info">
                Używasz urządzenia z iOS? Otwórz menu udostępnienia w przeglądarce i wybierz <strong>"Do ekranu początkowego"</strong>.
            </p>
        {/if}
    </div>
{/if}
