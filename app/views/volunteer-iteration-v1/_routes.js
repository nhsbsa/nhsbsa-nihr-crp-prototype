// ********************************
// VOLUNTEER
// ********************************

// External dependencies
const express = require('express');
const router = express.Router();

// Volunteer MVP


router.post('/start', function (req, res) {
 
    res.redirect('condition');

})

router.post('/condition', function (req, res) {

    var conditionQuestion = req.session.data['Condition'];

    if (conditionQuestion == "Yes") {
        res.redirect('medication');
    } else if (conditionQuestion == "No") {
        res.redirect('no-match');
    } else {
        res.redirect('condition');

    }

})

router.post('/medication', function (req, res) {

    var medicationQuestion = req.session.data['Medication'];

    if (medicationQuestion == "Yes") {
        res.redirect('diagnosis');
    } else if (medicationQuestion == "No") {
        res.redirect('no-match');
    } else {
        res.redirect('medication');

    }

})

router.post('/diagnosis', function (req, res) {

    var diagnosisQuestion = req.session.data['Diagnosis'];

    if (diagnosisQuestion == "Yes") {
        res.redirect('hospital');
    } else if (diagnosisQuestion == "No") {
        res.redirect('no-match');
    } else {
        res.redirect('diagnosis');

    }

})

router.post('/hospital', function (req, res) {

    var hospitalQuestion = req.session.data['Hospital'];

    if (hospitalQuestion == "Yes") {
        res.redirect('free-form-three');
    } else if (hospitalQuestion == "No") {
        res.redirect('free-form-three');
    } else {
        res.redirect('hospital');

    }

})

router.post('/free-form-three', function (req, res) {

    var freeformthreeQuestion = req.session.data['FreeFormThree'];

    if (freeformthreeQuestion == "Yes") {
        res.redirect('free-form-four');
    } else if (freeformthreeQuestion == "No") {
        res.redirect('no-match');
    } else {
        res.redirect('free-form-three');

    }

})

router.post('/free-form-four', function (req, res) {

    var freeformfourQuestion = req.session.data['FreeFormFour'];

    if (freeformfourQuestion == "Yes") {
        res.redirect('free-form-five');
    } else if (freeformfourQuestion == "No") {
        res.redirect('no-match');
    } else {
        res.redirect('free-form-four');

    }

})

router.post('/free-form-five', function (req, res) {

    var freeformfiveQuestion = req.session.data['FreeFormFive'];

    if (freeformfiveQuestion == "Yes") {
        res.redirect('review-details');
    } else if (freeformfiveQuestion == "No") {
        res.redirect('no-match');
    } else {
        res.redirect('free-form-five');

    }

})

router.post('/review-details', function (req, res) {

    var phoneNumber = req.session.data['phoneNumber'];

    res.redirect('check-your-answers');

})

router.post('/check-your-answers', function (req, res) {

    var conditionQuestion = req.session.data['Condition'];
    var medicationQuestion = req.session.data['Medication'];
    var diagnosisQuestion = req.session.data['Diagnosis'];
    var hospitalQuestion = req.session.data['Hospital'];
    var freeformthreeQuestion = req.session.data['FreeFormThree'];
    var freeformfourQuestion = req.session.data['FreeFormFour'];
    var freeformfiveQuestion = req.session.data['FreeFormFive'];

    if (hospitalQuestion === "Yes" || hospitalQuestion === "No") {
        res.redirect('partial-match');
    } else if (conditionQuestion === "Yes" && medicationQuestion === "Yes" && diagnosisQuestion === "Yes" && freeformthreeQuestion === "Yes" && freeformfourQuestion === "Yes" && freeformfiveQuestion === "Yes") {
        res.redirect('match');
    }

})

module.exports = router;