<script>
export default {
  name: 'Base',
  
  props: {
    message: {
      type: String,
      default: ''
    }
  },
  
  data() {
    return {
      value: 0,
      user: {
        name: 'John',
        age: 30
      }
    }
  },
  
  computed: {
    count() {
      return `Счётчик нажатий: ${this.value}`
    }
  },
  
  methods: {
    counter() {
      this.value += 1
    }
  },
  
  watch: {
    value(val) {
      console.log('Тест слежения', val)
    }
  },
  
  mounted() {
    console.log('Тест хуков жизненного цикла')
  },
}
</script>

<template>

  <div class="block">
    <h2>{{message}}</h2>
    <p>{{count}}</p>
    
    <button @click="counter">
      +1
    </button>
  </div>

</template>

<style scoped>
.block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

p {
  font-size: 16px;
}

button {
  border: none;
  background: #747bff;
  color: #fff;
  font-size: 16px;
  border-radius: 8px;
  padding: 8px 12px;
}
</style>
