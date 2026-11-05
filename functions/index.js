"use strict";

const {initializeApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
const {onDocumentCreated} = require('firebase-functions/v2/firestore');
const {processRound} = require('./fair-play-detector.cjs');

initializeApp();

exports.reviewFairPlayRound = onDocumentCreated({
    document: 'fairPlayPlayers/{uid}/rounds/{roundId}',
    retry: true,
    maxInstances: 5,
    memory: '256MiB'
}, async event => {
    if (!event.data) return;
    await processRound(getFirestore(), event.params.uid);
});
