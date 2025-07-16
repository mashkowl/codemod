<script>
export default {
  data() {
    return {
      imageUrl: 'https://lifehacker.ru/wp-content/uploads/2024/12/umirotvoryayushhaya_kartinka_dlya_samyx_bespokojnyx_pirozhochkov__1732808526.png',
      showContent: false,
      imageAlt: 'alt'
    }
  },
  
  methods: {
    handleClick() {
      // Здесь что-то происходит...
    },
  },
}
</script>

<template>
  <div>
    <button v-on:click.native="handleClick">Click</button>
    <img v-bind:src="imageUrl" v-bind:alt="imageAlt">
    <template slot="header">
      <p>Header</p>
    </template>
    <template #header>
      <p>text</p>
    </template>
  </div>
</template>