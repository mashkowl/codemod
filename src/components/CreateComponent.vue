<script>
import { reactive } from 'vue';

const product = reactive({
  image: '\'https://lifehacker.ru/wp-content/uploads/2024/12/umirotvoryayushhaya_kartinka_dlya_samyx_bespokojnyx_pirozhochkov__1732808526.png\',',
  name: 'Какое-то название',
  price: 100,
})

const addToCart = (product) => {
  //добавление продукта в корзину
}
</script>

<template>
  <div class="product-card">
    <img :src="product.image" />
    <h3>{{ product.name }}</h3>
    <p>{{ product.price }}$</p>
    <button @click="addToCart(product)">Buy</button>
  </div>
</template>

