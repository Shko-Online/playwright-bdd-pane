Feature: Todo list

  Background:
    Given I open the todo app

  Scenario: Add a single todo
    When I add the todo "Buy milk"
    Then I see 1 todo
    And I see the todo "Buy milk"

  Scenario: Add several todos
    When I add the todo "Write tests"
    And I add the todo "Publish report"
    Then I see 2 todos

  Scenario: Deliberately failing scenario
    When I add the todo "This one fails"
    Then I see 3 todos
