package com.asiainfo.biapp.pec.plan.jx.strategyreview.config;

import com.asiainfo.biapp.pec.core.common.ActionResponse;
import com.asiainfo.biapp.pec.core.exception.BaseException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * 全局异常处理：将业务异常与参数校验异常统一为 ActionResponse 返回
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BaseException.class)
    public ActionResponse<Void> handleBaseException(BaseException e) {
        log.warn("业务异常：{}", e.getMessage());
        return ActionResponse.getFaildResp(e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ActionResponse<Void> handleMethodArgumentNotValid(MethodArgumentNotValidException e) {
        return ActionResponse.getFaildResp(firstErrorMsg(e.getBindingResult().getFieldError()));
    }

    @ExceptionHandler(BindException.class)
    public ActionResponse<Void> handleBindException(BindException e) {
        return ActionResponse.getFaildResp(firstErrorMsg(e.getBindingResult().getFieldError()));
    }

    private String firstErrorMsg(FieldError error) {
        return error == null ? "参数校验失败" : error.getDefaultMessage();
    }
}