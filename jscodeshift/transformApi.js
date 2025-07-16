import { parse } from 'vue/compiler-sfc';

const transformApi = (fileInfo, api, options) => {
  const j = api.jscodeshift;
  const { descriptor } = parse(fileInfo.source);

  if (!descriptor.script) return fileInfo.source;

  const scriptContent = descriptor.script.content;
  const root = j(scriptContent);

  // 1. Find and prepare component export
  const exportDefault = root.find(j.ExportDefaultDeclaration);
  if (exportDefault.size() === 0) return fileInfo.source;

  // 2. Extract all component options
  const componentOptions = {
    data: { properties: [], isFunction: false },
    methods: { properties: [] },
    computed: { properties: [] },
    watch: { properties: [] },
    props: { properties: [] },
    lifecycle: []
  };

  const lifecycleMap = {
    'beforeCreate': 'onBeforeMount',
    'created': 'onMounted',
    'beforeMount': 'onBeforeMount',
    'mounted': 'onMounted',
    'beforeUpdate': 'onBeforeUpdate',
    'updated': 'onUpdated',
    'beforeDestroy': 'onBeforeUnmount',
    'destroyed': 'onUnmounted'
  };

  exportDefault.get('declaration').node.properties?.forEach(prop => {
    if (!prop.key?.name) return;

    switch (prop.key.name) {
      case 'data':
        componentOptions.data.isFunction = ['FunctionExpression', 'ArrowFunctionExpression'].includes(prop.value.type);
        const dataContent = componentOptions.data.isFunction
          ? prop.value.body.body.find(n => n.type === 'ReturnStatement')?.argument
          : prop.value;
        if (dataContent?.type === 'ObjectExpression') {
          componentOptions.data.properties = dataContent.properties;
        }
        break;

      case 'methods':
      case 'computed':
      case 'watch':
      case 'props':
        if (prop.value.type === 'ObjectExpression') {
          componentOptions[prop.key.name].properties = prop.value.properties;
        } else if (prop.key.name === 'props' && prop.value.type === 'ArrayExpression') {
          componentOptions.props.properties = prop.value.elements.map(el =>
            j.property('init', j.identifier(el.value), j.identifier(el.value))
          );
        }
        break;

      default:
        if (lifecycleMap[prop.key.name]) {
          componentOptions.lifecycle.push({
            optionsName: prop.key.name,
            compositionName: lifecycleMap[prop.key.name],
            value: prop.value
          });
        }
    }
  });

  // 3. Generate setup function content
  const setupBody = [];
  const usedApis = new Set(['ref']);

  // Process data
  componentOptions.data.properties.forEach(prop => {
    // Определяем начальное значение
    let initialValue = prop.value;


    // Для объектов создаем чистую версию без лишних оберток
    if (initialValue.type === 'ObjectExpression') {
      setupBody.push(
        j.variableDeclaration('const', [
          j.variableDeclarator(
            j.identifier(prop.key.name),
            j.callExpression(
              j.identifier('reactive'),
              [initialValue]
            )
          )
        ])
      );
      usedApis.add('reactive');
    } else {
      // Для примитивов используем ref с прямым значением
      setupBody.push(
        j.variableDeclaration('const', [
          j.variableDeclarator(
            j.identifier(prop.key.name),
            j.callExpression(
              j.identifier('ref'),
              [initialValue]
            )
          )
        ])
      );
    }
  });

  // Process methods
  componentOptions.methods.properties.forEach(method => {
    if (method.type !== 'Property') return;

    setupBody.push(
      j.functionDeclaration(
        j.identifier(method.key.name),
        method.value.params,
        method.value.body
      )
    );
  });

  // Process computed
  componentOptions.computed.properties.forEach(computed => {
    if (computed.type !== 'Property') return;

    usedApis.add('computed');
    setupBody.push(
      j.variableDeclaration('const', [
        j.variableDeclarator(
          j.identifier(computed.key.name),
          j.callExpression(j.identifier('computed'), [computed.value])
        )
      ])
    );
  });

  // Process lifecycle hooks
  componentOptions.lifecycle.forEach(hook => {
    usedApis.add(hook.compositionName);
    setupBody.push(
      j.expressionStatement(
        j.callExpression(
          j.identifier(hook.compositionName),
          [hook.value]
        )
      )
    );
  });

  // Process watch hooks
  componentOptions.watch.properties.forEach(watchProp => {
    if (watchProp.type !== 'Property') return;

    usedApis.add('watch');
    // 1. Создаем простой getter: () => value
    const watchedProperty = watchProp.key.name;
    const getter = j.arrowFunctionExpression(
      [], // Нет параметров
      j.identifier(watchedProperty) // Просто возвращаем значение
    );

    // 2. Обрабатываем обработчик
    let handler = watchProp.value;
    let options = null;

    // Для случая { handler: fn, deep: true }
    if (watchProp.value.type === 'ObjectExpression') {
      const handlerProp = watchProp.value.properties.find(p => p.key.name === 'handler');
      if (handlerProp) {
        handler = handlerProp.value;
        const deepProp = watchProp.value.properties.find(p => p.key.name === 'deep');
        if (deepProp) {
          options = j.objectExpression([deepProp]);
        }
      }
    }

    // 3. Преобразуем function(val) в (val) =>
    if (handler.type === 'FunctionExpression') {
      handler = j.arrowFunctionExpression(
        handler.params,
        handler.body
      );
    }

    // 4. Создаем вызов watch
    const watchCall = j.expressionStatement(
      j.callExpression(
        j.identifier('watch'),
        [
          getter,
          handler,
          options
        ].filter(Boolean)
      )
    );

    setupBody.push(watchCall);
  });

  // 4. Prepare return statement
  const returnProps = [];

  // helper
  const addProperty = (name, value = null, isShorthand = false) => {
    if (isShorthand) {
      const idNode = {...j.identifier(name), shorthand: true};
      returnProps.push(
        j.objectProperty(
          idNode,
          idNode,
          false,
          true
        )
      );
    } else {
      returnProps.push(
        j.objectProperty(
          j.identifier(name),
          value || j.identifier(name)
        )
      );
    }
  };

  // Add data properties (shorthand)
  componentOptions.data.properties.forEach(prop => {
    if (prop.type === 'Property') {
      addProperty(prop.key.name, null, true);
    }
  });

  // Add methods (shorthand)
  componentOptions.methods.properties.forEach(method => {
    if (method.type === 'Property') {
      addProperty(method.key.name, null, true);
    }
  });

  // Add computed (shorthand)
  componentOptions.computed.properties.forEach(computed => {
    if (computed.type === 'Property') {
      addProperty(computed.key.name, null, true);
    }
  });

  // Add props (full notation)
  componentOptions.props.properties.forEach(prop => {
    const propName = prop.key?.name || prop.value?.value;
    if (propName) {
      addProperty(
        propName,
        j.memberExpression(
          j.identifier('props'),
          j.identifier(propName)
        )
      );
    }
  });

  // Add return statement
  setupBody.push(
    j.returnStatement(
      j.objectExpression(returnProps)
    )
  );

  // 5. Create setup function
  const hasProps = componentOptions.props.properties.length > 0;

  const setupFunction = j.objectMethod(
    'method',
    j.identifier('setup'),
    hasProps ? [j.objectPattern([
      j.objectProperty(
        j.identifier('props'),
        j.identifier('props'),
        false,
        true
      )
    ])] : [],
    j.blockStatement([
      ...setupBody
    ])
  );

  // 6. Create new component options
  const newComponentOptions = j.objectExpression([
    ...(hasProps
      ? [j.property('init', j.identifier('props'),
        componentOptions.props.properties[0].value
      )]
      : []),
    setupFunction
  ]);

  exportDefault.get('declaration').replace(newComponentOptions);

  // 7. Add imports
  const vueImport = root.find(j.ImportDeclaration, {
    source: { value: 'vue' }
  });

  if (vueImport.size() > 0) {
    vueImport.forEach(path => {
      const existing = path.value.specifiers.map(s => s.imported?.name);
      Array.from(usedApis).forEach(api => {
        if (!existing.includes(api)) {
          path.value.specifiers.push(j.importSpecifier(j.identifier(api)));
        }
      });
    });
  } else {
    root.get().node.program.body.unshift(
      j.importDeclaration(
        Array.from(usedApis).map(api => j.importSpecifier(j.identifier(api))),
        j.literal('vue')
      )
    );
  }

  // 8. Return modified file
  return fileInfo.source.replace(
    /<script>([\s\S]*?)<\/script>/,
    `<script>\n${root.toSource({
      shorthand: true
    })}\n<\/script>`
  );
};

export default transformApi;