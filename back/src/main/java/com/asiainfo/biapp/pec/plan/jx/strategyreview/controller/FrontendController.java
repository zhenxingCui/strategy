package com.asiainfo.biapp.pec.plan.jx.strategyreview.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/** Serves the Vue entry point for history-mode routes. */
@Controller
public class FrontendController {

    @GetMapping({"/login", "/strategyReview"})
    public String forwardToIndex() {
        return "forward:/index.html";
    }
}
