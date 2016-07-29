import test from 'ava';
import {MongoClient} from 'mongodb';
import {MongoCron} from '..';
import moment from 'moment';

test.beforeEach(async (t) => {
  t.context.db = await MongoClient.connect('mongodb://localhost:27017/mongodb-cron-test');
  t.context.collection = t.context.db.collection('events');
});

test.afterEach(async (t) => {
  await t.context.collection.drop();
  await t.context.db.close();
});

test.serial.cb('document with `enabled=true` should trigger the `onDocument` handler', (t) => {
  let {collection} = t.context;
  let cron = new MongoCron({
    collection,
    onDocument: async (doc, cron) => {
      t.pass();
      t.end();
      await cron.stop({force: true});
    }
  });
  cron.start();
  collection.insert({
    enabled: true
  });
});

test.serial.cb('document with `waitUntil` should delay execution', (t) => {
  let {collection} = t.context;
  let time = moment().add(3000, 'millisecond');
  let cron = new MongoCron({
    collection,
    onDocument: async (doc, cron) => {
      if (moment() >= time) {
        t.pass();
      } else {
        t.fail();
      }
      t.end();
      await cron.stop({force: true});
    }
  });
  cron.start();
  collection.insert({
    enabled: true,
    waitUntil: time.toDate()
  });
});

test.serial.cb('document with `interval` should become a recurring job', (t) => {
  let {collection} = t.context;
  let repeated = 0;
  let cron = new MongoCron({
    collection,
    onDocument: async (doc, cron) => repeated++
  });
  cron.start();
  collection.insert({
    enabled: true,
    interval: '* * * * * *'
  });
  setTimeout(() => {
    if (repeated >= 2) {
      t.pass();
    } else {
      t.fail();
    }
    t.end();
    cron.stop();
  }, 3000);
});

test.serial.cb('document should stop recurring at `expireAt`', (t) => {
  let {collection} = t.context;
  let stop = moment().add(3000, 'millisecond');
  let repeated = 0;
  let cron = new MongoCron({
    collection,
    onDocument: async (doc, cron) => repeated++,
    reprocessDelay: 1000
  });
  cron.start();
  collection.insert({
    enabled: true,
    interval: '* * * * * *',
    expireAt: stop.toDate()
  });
  setTimeout(() => {
    if (repeated === 2) {
      t.pass();
    } else {
      t.fail();
    }
    t.end();
    cron.stop();
  }, 3000);
});

test.serial.cb('document with `deleteExpired` should be deleted when expired', (t) => {
  let {collection} = t.context;
  let stop = moment().add(3000, 'millisecond');
  let repeated = 0;
  let cron = new MongoCron({
    collection
  });
  cron.start();
  collection.insert({
    enabled: true,
    deleteExpired: true
  });
  setTimeout(() => {
    cron.stop();
    collection.count().then((n) => {
      if (n === 0) {
        t.pass();
      } else {
        t.fail();
      }
      t.end();
    })
  }, 2000);
});