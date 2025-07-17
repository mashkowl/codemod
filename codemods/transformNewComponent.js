import { parse } from 'vue/compiler-sfc';

const transformNewComponent = (fileInfo, api, options) => {
  const { descriptor } = parse(fileInfo.source);

  console.log(descriptor.script)
  // 1. Проверяем наличие шаблона и обычного script (не setup)
  if (!descriptor.template || !descriptor.script || descriptor.script.attrs?.setup) {
    return fileInfo.source;
  }

  const templateContent = descriptor.template.content;
  const originalScriptContent = descriptor.script.content;

  // 2. Проверяем структуру шаблона
  const isMatch = templateContent.includes('class="product-card"') &&
    templateContent.includes('product.image') &&
    templateContent.includes('product.name') &&
    templateContent.includes('product.price') &&
    templateContent.includes('addToCart(product)');

  if (!isMatch) {
    return fileInfo.source;
  }

  // 3. Заменяем шаблон
  const newTemplate = `<template>
  <ProductCard 
    :product="product" 
    @add-to-cart="addToCart" 
  />
</template>`;

  // 4. Подготавливаем новое содержимое script
  let newScriptContent = originalScriptContent;

  // Добавляем импорт компонента
  if (!newScriptContent.includes('import ProductCard from')) {
    newScriptContent = `import ProductCard from './ProductCard.vue';\n${newScriptContent}`;
  }

  // Добавляем компонент в exports
  if (!newScriptContent.includes('components:')) {
    newScriptContent = newScriptContent.replace(
      /export default\s*{([\s\S]*?)}/,
      `export default {\n  components: {\n    ProductCard\n  },$1\n}`
    );
  } else if (!newScriptContent.includes('ProductCard')) {
    newScriptContent = newScriptContent.replace(
      /components:\s*{([\s\S]*?)}/,
      `components: {\n    ProductCard,$1\n  }`
    );
  }

  // 5. Собираем итоговый файл, сохраняя теги <script>
  const scriptWithTags = `<script setup lang="ts">
${newScriptContent}
</script>`;

  const newFileContent = fileInfo.source
    .replace(
      /<template>[\s\S]*?<\/template>/,
      newTemplate
    )
    .replace(
      /<script>[\s\S]*?<\/script>/,
      scriptWithTags
    );

  return newFileContent;
};

export default transformNewComponent;