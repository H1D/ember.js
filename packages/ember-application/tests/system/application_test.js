/*globals EmberDev */

import Ember from 'ember-metal/core';
import { ENV, context } from 'ember-environment';
import run from 'ember-metal/run_loop';
import Application, { _resetLegacyAddonWarnings } from 'ember-application/system/application';
import DefaultResolver from 'ember-application/system/resolver';
import Router from 'ember-routing/system/router';
import View from 'ember-views/views/view';
import Controller from 'ember-runtime/controllers/controller';
import NoneLocation from 'ember-routing/location/none_location';
import EmberObject from 'ember-runtime/system/object';
import EmberRoute from 'ember-routing/system/route';
import jQuery from 'ember-views/system/jquery';
import compile from 'ember-template-compiler/system/compile';
import { _loaded } from 'ember-runtime/system/lazy_load';
import { getDebugFunction, setDebugFunction } from 'ember-metal/debug';

var trim = jQuery.trim;

var app, application, originalLookup, originalDebug, originalWarn;

QUnit.module('Ember.Application', {
  setup() {
    originalLookup = context.lookup;
    originalDebug = getDebugFunction('debug');
    originalWarn = getDebugFunction('warn');

    jQuery('#qunit-fixture').html('<div id=\'one\'><div id=\'one-child\'>HI</div></div><div id=\'two\'>HI</div>');
    run(function() {
      application = Application.create({ rootElement: '#one', router: null });
    });
  },

  teardown() {
    jQuery('#qunit-fixture').empty();
    setDebugFunction('debug', originalDebug);
    setDebugFunction('warn', originalWarn);

    context.lookup = originalLookup;

    if (application) {
      run(application, 'destroy');
    }

    if (app) {
      run(app, 'destroy');
    }
  }
});

QUnit.test('you can make a new application in a non-overlapping element', function() {
  run(function() {
    app = Application.create({ rootElement: '#two', router: null });
  });

  run(app, 'destroy');
  ok(true, 'should not raise');
});

QUnit.test('you cannot make a new application that is a parent of an existing application', function() {
  expectAssertion(function() {
    run(function() {
      Application.create({ rootElement: '#qunit-fixture' });
    });
  });
});

QUnit.test('you cannot make a new application that is a descendant of an existing application', function() {
  expectAssertion(function() {
    run(function() {
      Application.create({ rootElement: '#one-child' });
    });
  });
});

QUnit.test('you cannot make a new application that is a duplicate of an existing application', function() {
  expectAssertion(function() {
    run(function() {
      Application.create({ rootElement: '#one' });
    });
  });
});

QUnit.test('you cannot make two default applications without a rootElement error', function() {
  expectAssertion(function() {
    run(function() {
      Application.create({ router: false });
    });
  });
});

QUnit.test('acts like a namespace', function() {
  var lookup = context.lookup = {};

  run(function() {
    app = lookup.TestApp = Application.create({ rootElement: '#two', router: false });
  });

  Ember.BOOTED = false;
  app.Foo = EmberObject.extend();
  equal(app.Foo.toString(), 'TestApp.Foo', 'Classes pick up their parent namespace');
});

QUnit.test('includes deprecated access to `application.registry`', function() {
  expect(3);

  ok(typeof application.registry.register === 'function', '#registry.register is available as a function');

  application.__registry__.register = function() {
    ok(true, '#register alias is called correctly');
  };

  expectDeprecation(function() {
    application.registry.register();
  }, /Using `Application.registry.register` is deprecated. Please use `Application.register` instead./);
});

const originalLogVersion = ENV.LOG_VERSION;

QUnit.module('Ember.Application initialization', {
  teardown() {
    if (app) {
      run(app, 'destroy');
    }
    Ember.TEMPLATES = {};
    ENV.LOG_VERSION = originalLogVersion;
  }
});

QUnit.test('initialized application goes to initial route', function() {
  run(function() {
    app = Application.create({
      rootElement: '#qunit-fixture'
    });

    app.Router.reopen({
      location: 'none'
    });

    app.register('template:application',
      compile('{{outlet}}')
    );

    Ember.TEMPLATES.index = compile(
      '<h1>Hi from index</h1>'
    );
  });

  equal(jQuery('#qunit-fixture h1').text(), 'Hi from index');
});

QUnit.test('ready hook is called before routing begins', function() {
  expect(2);

  run(function() {
    function registerRoute(application, name, callback) {
      var route = EmberRoute.extend({
        activate: callback
      });

      application.register('route:' + name, route);
    }

    var MyApplication = Application.extend({
      ready() {
        registerRoute(this, 'index', function() {
          ok(true, 'last-minute route is activated');
        });
      }
    });

    app = MyApplication.create({
      rootElement: '#qunit-fixture'
    });

    app.Router.reopen({
      location: 'none'
    });

    registerRoute(app, 'application', function() {
      ok(true, 'normal route is activated');
    });
  });
});

QUnit.test('initialize application via initialize call', function() {
  run(function() {
    app = Application.create({
      rootElement: '#qunit-fixture'
    });

    app.Router.reopen({
      location: 'none'
    });

    app.ApplicationView = View.extend({
      template: compile('<h1>Hello!</h1>')
    });
  });

  // This is not a public way to access the container; we just
  // need to make some assertions about the created router
  var router = app.__container__.lookup('router:main');
  equal(router instanceof Router, true, 'Router was set from initialize call');
  equal(router.location instanceof NoneLocation, true, 'Location was set from location implementation name');
});

QUnit.test('initialize application with stateManager via initialize call from Router class', function() {
  run(function() {
    app = Application.create({
      rootElement: '#qunit-fixture'
    });

    app.Router.reopen({
      location: 'none'
    });

    app.register('template:application', compile('<h1>Hello!</h1>'));
  });

  var router = app.__container__.lookup('router:main');
  equal(router instanceof Router, true, 'Router was set from initialize call');
  equal(jQuery('#qunit-fixture h1').text(), 'Hello!');
});

import isEnabled from 'ember-metal/features';
if (!isEnabled('ember-glimmer')) {
  // jscs:disable

QUnit.test('ApplicationView is inserted into the page', function() {
  run(function() {
    app = Application.create({
      rootElement: '#qunit-fixture'
    });

    app.ApplicationView = View.extend({
      template: compile('<h1>Hello!</h1>')
    });

    app.ApplicationController = Controller.extend();

    app.Router.reopen({
      location: 'none'
    });
  });

  equal(jQuery('#qunit-fixture h1').text(), 'Hello!');
});

}

QUnit.test('Minimal Application initialized with just an application template', function() {
  jQuery('#qunit-fixture').html('<script type="text/x-handlebars">Hello World</script>');
  run(function () {
    app = Application.create({
      rootElement: '#qunit-fixture'
    });
  });

  equal(trim(jQuery('#qunit-fixture').text()), 'Hello World');
});

QUnit.test('enable log of libraries with an ENV var', function() {
  if (EmberDev && EmberDev.runningProdBuild) {
    ok(true, 'Logging does not occur in production builds');
    return;
  }

  var messages = [];

  ENV.LOG_VERSION = true;

  setDebugFunction('debug', function(message) {
    messages.push(message);
  });

  Ember.libraries.register('my-lib', '2.0.0a');

  run(function() {
    app = Application.create({
      rootElement: '#qunit-fixture'
    });
  });

  equal(messages[1], 'Ember  : ' + Ember.VERSION);
  equal(messages[2], 'jQuery : ' + jQuery().jquery);
  equal(messages[3], 'my-lib : ' + '2.0.0a');

  Ember.libraries.deRegister('my-lib');
});

QUnit.test('disable log version of libraries with an ENV var', function() {
  var logged = false;

  ENV.LOG_VERSION = false;

  setDebugFunction('debug', function(message) {
    logged = true;
  });

  jQuery('#qunit-fixture').empty();

  run(function() {
    app = Application.create({
      rootElement: '#qunit-fixture'
    });

    app.Router.reopen({
      location: 'none'
    });
  });

  ok(!logged, 'library version logging skipped');
});

QUnit.test('can resolve custom router', function() {
  var CustomRouter = Router.extend();

  var CustomResolver = DefaultResolver.extend({
    resolveMain(parsedName) {
      if (parsedName.type === 'router') {
        return CustomRouter;
      } else {
        return this._super(parsedName);
      }
    }
  });

  app = run(function() {
    return Application.create({
      Resolver: CustomResolver
    });
  });

  ok(app.__container__.lookup('router:main') instanceof CustomRouter, 'application resolved the correct router');
});

QUnit.test('can specify custom router', function() {
  var CustomRouter = Router.extend();

  app = run(function() {
    return Application.create({
      Router: CustomRouter
    });
  });

  ok(app.__container__.lookup('router:main') instanceof CustomRouter, 'application resolved the correct router');
});

QUnit.test('does not leak itself in onLoad._loaded', function() {
  equal(_loaded.application, undefined);
  var app = run(Application, 'create');
  equal(_loaded.application, app);
  run(app, 'destroy');
  equal(_loaded.application, undefined);
});

const originalLegacyViewSupport = ENV._ENABLE_LEGACY_VIEW_SUPPORT;
const originalLegacyControllerSupport = ENV._ENABLE_LEGACY_CONTROLLER_SUPPORT;

QUnit.module('Ember.Application - legacy addon deprecation warnings', {
  setup() {
    ENV._ENABLE_LEGACY_VIEW_SUPPORT = false;
    ENV._ENABLE_LEGACY_CONTROLLER_SUPPORT = false;

    originalDebug = getDebugFunction('debug');
    originalWarn = getDebugFunction('warn');

    _resetLegacyAddonWarnings();
  },

  teardown() {
    ENV._ENABLE_LEGACY_VIEW_SUPPORT = originalLegacyViewSupport;
    ENV._ENABLE_LEGACY_CONTROLLER_SUPPORT = originalLegacyControllerSupport;

    setDebugFunction('debug', originalDebug);
    setDebugFunction('warn', originalWarn);

    if (app) {
      run(app, 'destroy');
    }
  }
});

QUnit.test('it does not warn about the ember-legacy-views addon on first boot when not installed', function() {
  expectNoDeprecation();

  ENV._ENABLE_LEGACY_VIEW_SUPPORT = false;

  app = run(Application, 'create');
});

QUnit.test('it warns about the ember-legacy-views addon on first boot when installed', function() {
  ENV._ENABLE_LEGACY_VIEW_SUPPORT = true;

  expectDeprecation(() => {
    app = run(Application, 'create');
  }, 'Support for the `ember-legacy-views` addon will end soon, please remove it from your application.');

  run(app, 'destroy');

  // It should not warn again on second boot
  expectNoDeprecation(() => {
    app = run(Application, 'create');
  });
});

QUnit.test('it does not warn about the ember-legacy-controllers addon on first boot when not installed', function() {
  expectNoDeprecation();

  ENV._ENABLE_LEGACY_CONTROLLER_SUPPORT = false;

  app = run(Application, 'create');
});

QUnit.test('it warns about the ember-legacy-controllers addon on first boot when installed', function() {
  if (EmberDev.runningProdBuild) {
    ok(true, 'warnings are disabled in prod builds');
    return;
  }

  ENV._ENABLE_LEGACY_CONTROLLER_SUPPORT = true;

  let warning;
  setDebugFunction('warn', function(message, test) {
    if (!test) {
      warning = message;
    }
  });

  app = run(Application, 'create');

  equal(warning, 'Support for the `ember-legacy-controllers` has been removed, please remove it from your application.');

  run(app, 'destroy');
  warning = null;

  // It should not warn again on second boot
  app = run(Application, 'create');
  equal(warning, null);
});
