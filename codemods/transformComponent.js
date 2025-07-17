import { parse } from 'vue/compiler-sfc';

const transformComponent = (fileInfo, api, options) => {
  const j = api.jscodeshift;
  const { descriptor } = parse(fileInfo.source);

  if (!descriptor.template) {
    return fileInfo.source;
  }

  // 1. Парсим шаблон
  const templateContent = descriptor.template.content;

  // 2. Простые замены в шаблоне
  let newTemplate = templateContent
    // Заменяем v-bind: на :
    .replace(/v-bind:/g, ':')
    // Заменяем v-on: на @
    .replace(/v-on:/g, '@')
    // Удаляем .native модификаторы
    .replace(/\.native/g, '')
    // Заменяем старый синтаксис слотов
    .replace(/<template slot="([^"]+)"/g, '<template v-slot:$1')
    .replace(/<template #([^"]+)"/g, '<template v-slot:$1');


  // 4. Собираем обратно файл
  return fileInfo.source.replace(
    /<template>([\s\S]*?)<\/template>/,
    `<template>\n${newTemplate}\n<\/template>`
  );
};

export default transformComponent;