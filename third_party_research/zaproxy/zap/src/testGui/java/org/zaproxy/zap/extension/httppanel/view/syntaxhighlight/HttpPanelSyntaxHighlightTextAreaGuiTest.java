/*
 * Zed Attack Proxy (ZAP) and its related class files.
 *
 * ZAP is an HTTP/HTTPS proxy for assessing web application security.
 *
 * Copyright 2026 The ZAP Development Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.zaproxy.zap.extension.httppanel.view.syntaxhighlight;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;
import static org.mockito.Mockito.mock;

import java.util.List;
import java.util.regex.Pattern;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.parosproxy.paros.Constant;
import org.zaproxy.testutils.AbstractGuiTest;
import org.zaproxy.zap.extension.httppanel.view.syntaxhighlight.menus.SyntaxMenu;
import org.zaproxy.zap.extension.search.SearchMatch;
import org.zaproxy.zap.utils.FontUtils;
import org.zaproxy.zap.utils.FontUtils.FontType;
import org.zaproxy.zap.utils.I18N;

/** GUI test for {@link HttpPanelSyntaxHighlightTextArea}. */
class HttpPanelSyntaxHighlightTextAreaGuiTest extends AbstractGuiTest {

    @BeforeAll
    static void setup() {
        Constant.messages = mock(I18N.class);
        FontUtils.setDefaultFont(FontType.general, "", 12);
        FontUtils.setDefaultFont(FontType.workPanels, "", 12);
        HttpPanelSyntaxHighlightTextArea.setSyntaxMenu(mock(SyntaxMenu.class));
    }

    @Test
    void shouldUndoProgrammaticSetTextAsSingleEdit() {
        executeInEdt(
                () -> {
                    // Given
                    var textArea = new TestHttpPanelSyntaxHighlightTextArea();
                    textArea.setText("old");
                    textArea.setText("new");
                    // When
                    textArea.undoLastAction();
                    // Then
                    assertThat(textArea.getText(), is(equalTo("old")));
                });
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = "same")
    void shouldNotCreateUndoEntryWhenSetTextDoesNotChangeText(String text) {
        executeInEdt(
                () -> {
                    // Given
                    var textArea = new TestHttpPanelSyntaxHighlightTextArea();
                    textArea.setText(text);
                    textArea.setText(text);
                    // When
                    textArea.undoLastAction();
                    // Then
                    assertThat(textArea.getText(), is(equalTo("")));
                    assertThat(textArea.canUndo(), is(equalTo(false)));
                });
    }

    @SuppressWarnings("serial")
    private static class TestHttpPanelSyntaxHighlightTextArea
            extends HttpPanelSyntaxHighlightTextArea {
        @Override
        public void search(Pattern p, List<SearchMatch> matches) {}

        @Override
        public void highlight(SearchMatch sm) {}

        @Override
        protected synchronized CustomTokenMakerFactory getTokenMakerFactory() {
            return new CustomTokenMakerFactory();
        }
    }
}
