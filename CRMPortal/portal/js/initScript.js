if ($('div#myTicketHistory, ' +
    'form#myTicketSearchForm, ' +
    'form[action="ticketNewProcess.asp"]').length > 0) {
    //on the correct page
    $.p2c.config({
        url: "http://localhost:64659/",
    });

    $.p2c.init();
}


