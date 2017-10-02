'use strict';

const common = require('./common');
const Foo = common.models.Foo;
const Bar = common.models.Bar;
const sequelize = common.sequelize;
const DataTypes = sequelize.Sequelize;
const should = common.should;
const $ = require('highland');
const _ = require('lodash');
const stream = require('stream');

describe('bulk upsert plugin', function () {

    describe('.bulkUpsertStream()', function () {

        it('should add the function to the prototype of Model', function () {
            Foo.should.respondTo('bulkUpsertStream');
        });

        it('should reject attempts to bulk upsert an undefined value', function () {
            return Foo.bulkUpsertStream().should.be.rejectedWith(Error);
        });

        it('should reject attemps to bulk upsert a non-Readable stream', function () {
            return Foo.bulkUpsertStream(new stream.Writable()).should.be.rejectedWith(Error);
        });

        it('should reject attempts to bulk upsert a non-Highland stream', function () {
            const badHighland = $();
            badHighland.__HighlandStream__ = false;
            return Foo.bulkUpsertStream(badHighland).should.be.rejectedWith(Error);
        });

        it('should reject attempts to bulk upsert a non-Array object', function () {
            return Foo.bulkUpsertStream({}).should.be.rejectedWith(Error);
        });

        it('should gracefully continue if passed an empty array', function () {
            return Foo.bulkUpsertStream([]).should.become(Foo);
        });

        it('should insert from an array', function () {
            const defns = [];
            _.times(5, n => defns.push({
                id: `id${n}`,
                immutableAttr: `immutable value ${n}`,
                name: `My Foo ${n}`
            }));
            return sequelize.requiresTransaction(t => Foo.bulkUpsertStream(defns, {
                omit: ['_changes'],
                transaction: t
            }))
                .then(() => Foo.findAll())
                .then(foos => {
                    foos.should.have.length(5);
                    _(foos)
                        .map(f => f.get())
                        .forEach((f, idx) => {
                            f.should.have.property('id', `id${idx}`);
                            f.should.have.property('immutableAttr', `immutable value ${idx}`);
                            f.should.have.property('name', `My Foo ${idx}`);
                        })
                        .value();
                });
        });

        it('should insert from a stream', function () {
            const defns = [];
            _.times(5, n => defns.push({
                id: `id${n}`,
                immutableAttr: `immutable value ${n}`,
                name: `My Foo ${n}`
            }));
            const $stream = $(defns);
            return sequelize.requiresTransaction(t => Foo.bulkUpsertStream($stream, {
                omit: ['_changes'],
                transaction: t
            }))
                .then(() => Foo.findAll())
                .then(foos => {
                    foos.should.have.length(5);
                    _(foos)
                        .map(f => f.get())
                        .forEach((f, idx) => {
                            f.should.have.property('id', `id${idx}`);
                            f.should.have.property('immutableAttr', `immutable value ${idx}`);
                            f.should.have.property('name', `My Foo ${idx}`);
                        })
                        .value();
                })
                ;
        });

        it('should update from a stream', function () {
            const $records = $([{
                id: 'foo',
                immutableAttr: 'asdf',
                name: 'My Foo'
            },
                {
                    id: 'bar',
                    immutableAttr: 'fdas',
                    name: 'My Bar'
                }]);
            return Foo.create({
                id: 'foo',
                immutableAttr: 'Foo\'s immutable value',
                name: 'Foo'
            })
                .then(() => Foo.create({
                    id: 'bar',
                    immutableAttr: 'Bar\s immutable value',
                    name: 'Bar'
                }))
                .then(() => sequelize.requiresTransaction(t => Foo.bulkUpsertStream($records, {
                    omit: ['_changes'],
                    transaction: t
                })))
                .then(() => Foo.findAll())
                .then(foos => {
                    foos.should.have.length(2);
                    _.forEach(foos, f => {
                        ['foo', 'bar'].should.include(f.id);
                        if (f.id === 'foo') {
                            f.name.should.equal('My Foo');
                        } else {
                            f.name.should.equal('My Bar');
                        }
                    });
                });
        });

        it('should update from an array', function () {
            const records = [{
                id: 'foo',
                immutableAttr: 'asdf',
                name: 'My Foo'
            },
                {
                    id: 'bar',
                    immutableAttr: 'fdas',
                    name: 'My Bar'
                }];
            return Foo.create({
                id: 'foo',
                immutableAttr: 'Foo\'s immutable value',
                name: 'Foo'
            })
                .then(() => Foo.create({
                    id: 'bar',
                    immutableAttr: 'Bar\s immutable value',
                    name: 'Bar'
                }))
                .then(() => sequelize.requiresTransaction(t => Foo.bulkUpsertStream(records, {
                    omit: ['_changes'],
                    transaction: t
                })))
                .then(() => Foo.findAll())
                .then(foos => {
                    foos.should.have.length(2);
                    _.forEach(foos, f => {
                        ['foo', 'bar'].should.include(f.id);
                        if (f.id === 'foo') {
                            f.name.should.equal('My Foo');
                        } else {
                            f.name.should.equal('My Bar');
                        }
                    });
                });
        });

        it('should insert and update from a stream', function () {
            const $records = $([
                { id: 'bar', immutableAttr: 'aaa', name: 'Bar' },
                { id: 'foo', immutableAttr: 'zzz', name: 'Upserted Foo' },
                { id: 'baz', immutableAttr: 'bbb', name: 'BAZZZZZ' }
            ]);
            return Foo.create({
                id: 'foo',
                immutableAttr: 'immutable',
                name: 'Foo'
            })
                .then(() => sequelize.requiresTransaction(t => Foo.bulkUpsertStream($records, {
                    omit: ['_changes'],
                    transaction: t
                })))
                .then(() => Foo.findAll())
                .then(foos => {
                    foos.should.have.length(3);
                    _.forEach(foos, foo => {
                        ['foo', 'bar', 'baz'].should.include(foo.id);
                        if (foo.id === 'foo') {
                            foo.name.should.equal('Upserted Foo');
                            foo.immutableAttr.should.equal('zzz');
                        } else if (foo.id === 'bar') {
                            foo.name.should.equal('Bar');
                            foo.immutableAttr.should.equal('aaa');
                        } else if (foo.id === 'baz') {
                            foo.name.should.equal('BAZZZZZ');
                            foo.immutableAttr.should.equal('bbb');
                        } else {
                            throw new Error(`Got an unknown id: ${foo.id}`);
                        }
                    });
                });
        });

        it('should insert and update from an array', function () {
            const records = [
                { id: 'bar', immutableAttr: 'aaa', name: 'Bar' },
                { id: 'foo', immutableAttr: 'zzz', name: 'Upserted Foo' },
                { id: 'baz', immutableAttr: 'bbb', name: 'BAZZZZZ' }
            ];
            return Foo.create({
                id: 'foo',
                immutableAttr: 'immutable',
                name: 'Foo'
            })
                .then(() => sequelize.requiresTransaction(t => Foo.bulkUpsertStream(records, {
                    omit: ['_changes'],
                    transaction: t
                })))
                .then(() => Foo.findAll())
                .then(foos => {
                    foos.should.have.length(3);
                    _.forEach(foos, foo => {
                        ['foo', 'bar', 'baz'].should.include(foo.id);
                        if (foo.id === 'foo') {
                            foo.name.should.equal('Upserted Foo');
                            foo.immutableAttr.should.equal('zzz');
                        } else if (foo.id === 'bar') {
                            foo.name.should.equal('Bar');
                            foo.immutableAttr.should.equal('aaa');
                        } else if (foo.id === 'baz') {
                            foo.name.should.equal('BAZZZZZ');
                            foo.immutableAttr.should.equal('bbb');
                        } else {
                            throw new Error(`Got an unknown id: ${foo.id}`);
                        }
                    });
                });
        });

        it('should not do anything to the database if an error occurs', function () {
            let upsertError;
            const $records = $([{
                id: 'foo',
                immutableAttr: 'asdf',
                name: 'My Foo'
            },
                {
                    id: 'foo',
                    immutableAttr: 'this wont be a value',
                    name: 'FOO'
                }]);
            return Foo.create({
                id: 'foo',
                immutableAttr: 'Foo\'s immutable value',
                name: 'Foo'
            })
                .then(() => Foo.bulkUpsertStream($records, { omit: ['_changes'] }))
                .catch(err => upsertError = err)
                .finally(() => {
                    should.exist(upsertError);
                    return Foo.findAll()
                        .then(foos => {
                            foos.should.have.length(1);
                            _.first(foos).id.should.equal('foo');
                            _.first(foos).immutableAttr.should.equal(`Foo's immutable value`);
                            _.first(foos).name.should.equal('Foo');
                        });
                });
        });

        it('should not prevent further interaction if an error occurs', function () {
            const badRecords = [
                { id: 'bar', immutableAttr: 'aaa', name: 'Bar' },
                { id: 'bar', immutableAttr: 'aaaaaa', name: 'BarBar' }
            ];
            const goodRecords = [
                { id: 'bar', immutableAttr: 'aaa', name: 'BAR' },
                { id: 'foo', immutableAttr: 'aaaaaa', name: 'FOOFOO' }
            ];
            let badRecErr, goodRecErr;
            return Foo.create({
                id: 'foo',
                immutableAttr: 'immutable',
                name: 'Foo'
            })
                .then(() => sequelize.requiresTransaction(t => Foo.bulkUpsertStream(badRecords, {
                    omit: ['_changes'],
                    transaction: t
                })))
                .catch(err => {
                    badRecErr = err;
                    return sequelize.requiresTransaction(t => Foo.bulkUpsertStream(goodRecords, {
                        omit: ['_changes'],
                        transaction: t
                    }))
                        .catch(err => goodRecErr = err);
                })
                .finally(() => {
                    should.exist(badRecErr);
                    should.not.exist(goodRecErr);
                    return Foo.findAll()
                        .then(foos => {
                            foos.should.have.length(2);
                            _.forEach(foos, foo => {
                                ['foo', 'bar'].should.include(foo.id);
                                if (foo.id === 'foo') {
                                    foo.name.should.equal('FOOFOO');
                                    foo.immutableAttr.should.equal('aaaaaa');
                                } else {
                                    foo.name.should.equal('BAR');
                                    foo.immutableAttr.should.equal('aaa');
                                }
                            });
                        });
                });
        });

        it('should always add timestamp attribute values to records if a model has timestamp fields', function () {
            const records = [{ id: 'bar', name: 'Bar', birthday: new Date() }, {
                id: 'foo',
                name: 'Foo',
                birthday: new Date()
            }];
            return sequelize.requiresTransaction(t => Bar.bulkUpsertStream(records, { transaction: t }))
                .then(() => Bar.findAll())
                .then(bars => {
                    should.exist(bars);
                    bars.should.have.length(2);
                    _.every(bars, bar => {
                        should.exist(bar.createdAt);
                        should.exist(bar.updatedAt);
                    });
                });
        });

        it('should not prevent further interaction if a constraint violation occurs', function () {
            let error;
            const records = [{ id: 'bar', name: 'Bar' }, { id: 'foo', name: 'Foo' }];
            return sequelize.requiresTransaction(t => Bar.bulkUpsertStream(records, { transaction: t }))
                .then(() => should.not.exist(`should not succeed`))
                .catch(err => error = err)
                .finally(() => {
                    let secondError;
                    should.exist(error);
                    return sequelize.requiresTransaction(t => Bar.bulkUpsertStream(_.map(records, r => _.set(r, 'birthday', new Date())), { transaction: t }))
                        .then(() => Bar.findAll())
                        .then(bars => {
                            should.exist(bars);
                            bars.should.have.length(2);
                            _.every(bars, bar => {
                                should.exist(bar.createdAt);
                                should.exist(bar.updatedAt);
                                should.exist(bar.birthday);
                            });
                        })
                        .catch(err => secondError = err)
                        .finally(() => should.not.exist(secondError));
                });
        });

        it('should trim virtual fields from records', function () {
            let error;
            const Baz = sequelize.define('Baz', {
                name: { type: DataTypes.STRING, primaryKey: true }
            }, {
                tableName: 'bazz',
                getterMethods: {
                    id() {
                        return this.name.toUpperCase();
                    }
                }
            });
            return sequelize.sync({ force: true })
                .then(() => sequelize.requiresTransaction(t => Baz.bulkUpsertStream([
                    { id: 1, name: 'firstBaz' },
                    { id: 2, name: 'secondBaz' }
                ], { transaction: t, idFields: ['name'] }))
                    .then(() => Baz.findAll())
                    .then(bazz => {
                        should.exist(bazz);
                        bazz.should.have.length(2);
                        _.every(bazz, b => {
                            should.exist(b.id);
                            b.id.should.not.be.a('number');
                            b.id.should.be.a('string');
                            b.id.should.equal(b.name.toUpperCase());
                        });
                    })
                    .catch(err => error = err)
                    .finally(() => should.not.exist(error)));

        });

        it('should remap record values for field with different db column name', function () {
            let error;
            const Baz = sequelize.define('Baz', {
                name: { type: DataTypes.STRING, primaryKey: true },
                data: { type: DataTypes.STRING, field: 'my_data_field' }
            }, { tableName: 'bazz', timestamps: false });
            return sequelize.sync({ force: true })
                .then(() => sequelize.requiresTransaction(t => Baz.bulkUpsertStream([{
                    name: 'BazBaz',
                    data: 'Some data for BazBaz'
                }], {
                    transaction: t,
                    idFields: ['name']
                }))
                    .then(() => Baz.findAll())
                    .then(bazz => {
                        should.exist(bazz);
                        bazz.should.have.length(1);
                        _.first(bazz).name.should.equal('BazBaz');
                        _.first(bazz).data.should.equal('Some data for BazBaz');
                    })
                    .catch(err => error = err)
                    .finally(() => should.not.exist(error)));
        });

        it('should remap record values for primary key field with different db column name', function () {
            let error;
            const Baz = sequelize.define('Baz', {
                name: { type: DataTypes.STRING, primaryKey: true, field: 'my_custom_name' }
            }, { tableName: 'bazz' });
            return sequelize.sync({ force: true })
                .then(() => sequelize.requiresTransaction(t => Baz.bulkUpsertStream([{ name: 'BazBaz' }], {
                    transaction: t,
                    idFields: ['name']
                }))
                    .then(() => Baz.findAll())
                    .then(bazz => {
                        should.exist(bazz);
                        bazz.should.have.length(1);
                        _.first(bazz).name.should.equal('BazBaz');
                    })
                    .catch(err => error = err)
                    .finally(() => should.not.exist(error)));
        });
    });

    describe('.bulkUpsert()', function () {
        it('should add the function to a Model', function () {
            Foo.should.respondTo('bulkUpsert');
        });

        it('should gracefully continue if passed an empty array', function () {
            return Foo.bulkUpsert([]).should.become(Foo);
        });

        it('should insert and update', function () {
            const records = [
                { id: 'bar', immutableAttr: 'aaa', name: 'Bar' },
                { id: 'foo', immutableAttr: 'zzz', name: 'Upserted Foo' }
            ];
            return Foo.create({
                id: 'foo',
                immutableAttr: 'immutable',
                name: 'Foo'
            })
                .then(() => sequelize.requiresTransaction(t => Foo.bulkUpsert(records, {
                    omit: ['_changes'],
                    transaction: t
                })))
                .then(() => Foo.findAll())
                .then(foos => {
                    foos.should.have.length(2);
                    _(foos)
                        .forEach(foo => {
                            if (foo.id === 'foo') {
                                foo.name.should.equal('Upserted Foo');
                                foo.immutableAttr.should.equal('zzz');
                            } else if (foo.id === 'bar') {
                                foo.name.should.equal('Bar');
                                foo.immutableAttr.should.equal('aaa');
                            } else {
                                throw new Error(`Got an unknown id: ${foo.id}`);
                            }
                        })
                        .value();
                });
        });

        it('should trim virtual fields from records', function () {
            let error;
            const Baz = sequelize.define('Baz', {
                name: { type: DataTypes.STRING, primaryKey: true }
            }, {
                tableName: 'bazz',
                getterMethods: {
                    id() {
                        return this.name.toUpperCase();
                    }
                }
            });
            return sequelize.sync({ force: true })
                .then(() => sequelize.requiresTransaction(t => Baz.bulkUpsert([
                    { id: 1, name: 'firstBaz' },
                    { id: 2, name: 'secondBaz' }
                ], { transaction: t, idFields: ['name'] }))
                    .then(() => Baz.findAll())
                    .then(bazz => {
                        should.exist(bazz);
                        bazz.should.have.length(2);
                        _.every(bazz, b => {
                            should.exist(b.id);
                            b.id.should.not.be.a('number');
                            b.id.should.be.a('string');
                            b.id.should.equal(b.name.toUpperCase());
                        });
                    })
                    .catch(err => error = err)
                    .finally(() => should.not.exist(error)));

        });

        it('should remap record values for field with different db column name', function () {
            let error;
            const Baz = sequelize.define('Baz', {
                name: { type: DataTypes.STRING, primaryKey: true },
                data: { type: DataTypes.STRING, field: 'my_data_field' }
            }, { tableName: 'bazz', timestamps: false });
            return sequelize.sync({ force: true })
                .then(() => sequelize.requiresTransaction(t => Baz.bulkUpsert([{
                    name: 'BazBaz',
                    data: 'Some data for BazBaz'
                }], {
                    transaction: t,
                    idFields: ['name']
                }))
                    .then(() => Baz.findAll())
                    .then(bazz => {
                        should.exist(bazz);
                        bazz.should.have.length(1);
                        _.first(bazz).name.should.equal('BazBaz');
                        _.first(bazz).data.should.equal('Some data for BazBaz');
                    })
                    .catch(err => error = err)
                    .finally(() => should.not.exist(error)));
        });

        it('should remap record values for primary key field with different db column name', function () {
            let error;
            const Baz = sequelize.define('Baz', {
                name: { type: DataTypes.STRING, primaryKey: true, field: 'my_custom_name' }
            }, { tableName: 'bazz' });
            return sequelize.sync({ force: true })
                .then(() => sequelize.requiresTransaction(t => Baz.bulkUpsert([{ name: 'BazBaz' }], {
                    transaction: t,
                    idFields: ['name']
                }))
                    .then(() => Baz.findAll())
                    .then(bazz => {
                        should.exist(bazz);
                        bazz.should.have.length(1);
                        _.first(bazz).name.should.equal('BazBaz');
                    })
                    .catch(err => error = err)
                    .finally(() => should.not.exist(error)));
        });
    });
});